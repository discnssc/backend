const supabase = require('../config/supabase');

const activitiesController = {
  /**
   * GET /participants/:participantId/activity-logs
   * Fetches activity logs for a specific participant.
   * Optional query params:
   *   ?start=2024-12-01&end=2025-03-31 → logs between dates inclusive
   */
  async getActivityLogsForParticipant(req, res) {
    try {
      const { participantId } = req.params;
      if (!participantId) {
        return res.status(400).json({ error: 'Missing participantId' });
      }

      const { start, end } = req.query;

      let query = supabase
        .from('activity_log')
        .select(
          `
          id,
          date,
          declined,
          rating,
          notes,
          schedule:activity_schedule_id ( id, name, date )
        `
        )
        .eq('participant_id', participantId);

      if (start) query = query.gte('date', start);
      if (end) query = query.lte('date', end);
      query = query.order('date', { ascending: false });
      const { data, error } = await query;
      if (error) {
        console.error('Supabase GET logs error:', error);
        return res.status(400).json({ error: error.message });
      }
      return res.status(200).json(data);
    } catch (err) {
      console.error('getActivityLogs error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * POST /participants/:participantId/activity-logs
   * Creates a new activity log for a single participant.
   * Useful for manually adding a log entry for one person.
   * Request body should contain:
   * {
   *   "activity_schedule_id": "uuid-of-schedule",
   *   "declined": false, // optional
   *   "rating": 5,       // optional
   *   "notes": "..."     // optional
   *   // "Date" is expected to be set by DB trigger based on activity_schedule.Date
   * }
   */
  async createActivityLog(req, res) {
    try {
      const { participantId } = req.params;
      const { activity_schedule_id, declined, rating, notes } = req.body;

      if (!participantId || !activity_schedule_id) {
        return res.status(400).json({
          error:
            'Missing required fields. Need: participantId, activity_schedule_id',
        });
      }

      // Insert the activity log in Supabase.
      // The trigger will set the "Date" based on activity_schedule_id.
      const { data, error } = await supabase
        .from('activity_log')
        .insert([
          {
            participant_id: participantId,
            activity_schedule_id,
            declined: declined || false, // Default to false if not provided
            rating: rating ?? null, // Default to null if not provided
            notes: notes || null, // Default to null if not provided
          },
        ])
        .select(
          `id, "date", participant_id, activity_schedule_id, declined, rating, notes`
        )
        .single();

      if (error) {
        console.error('Supabase create log error:', error);
        // Check for unique constraint violation if composite PK (activity_schedule_id, participant_id) exists
        if (error.code === '23505') {
          // Postgres unique_violation error code
          return res.status(409).json({
            error:
              'Conflict: Activity log for this participant and schedule already exists.',
          });
        }
        return res.status(400).json({ error: error.message });
      }

      return res.status(201).json(data);
    } catch (err) {
      console.error('createActivityLog error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * PUT /activities/:activityScheduleId/attendance
   * Records attendance and details for multiple participants for a specific scheduled activity.
   * Request body should be a JSON array of participant attendance objects:
   * [
   *   {
   *     "participantId": UUID,  // Participant's ID
   *     "declined": false, // boolean, optional
   *     "rating": 5,       // number, optional
   *     "notes": "..."     // text, optional
   *   },
   *   // ... more participant entries
   * ]
   */
  async recordAttendance(req, res) {
    try {
      const { activityId } = req.params; // Get scheduled activity ID from URL
      const participantAttendance = req.body;

      if (!activityId) {
        return res.status(400).json({ error: 'Missing activityId in URL' });
      }

      if (
        !Array.isArray(participantAttendance) ||
        participantAttendance.length === 0
      ) {
        return res.status(400).json({
          error:
            'Request body must be a non-empty array of participant attendance data.',
        });
      }

      const logsToInsert = [];
      const errors = [];

      // Use Promise.all to handle asynchronous lookups efficiently
      await Promise.all(
        participantAttendance.map(async (attendanceEntry, index) => {
          const { participantId, declined, rating, notes } = attendanceEntry;

          if (!participantId) {
            errors.push(`Entry ${index}: Missing participant_id.`);
            console.warn(
              'Skipping attendance entry due to missing participant id:',
              attendanceEntry
            );
            return; // Skip this entry in logsToInsert, add to errors
          }

          logsToInsert.push({
            activity_schedule_id: activityId, // Link to the scheduled activity
            participant_id: participantId,
            declined: declined || false,
            rating: rating ?? null,
            notes: notes || null,
          });
        })
      ); // End Promise.all map

      if (logsToInsert.length === 0 || errors.length > 0) {
        return res.status(400).json({
          error:
            'No valid participant attendance data provided' + errors.join(', '),
        });
      }
      const { data, error } = await supabase
        .from('activity_log')
        .upsert(logsToInsert, {
          onConflict: ['activity_schedule_id', 'participant_id'], // Composite unique keys
        });

      if (error) {
        console.error('Supabase recordAttendance error:', error);
        // Check for unique constraint violation (composite PK: activity_schedule_id, participant_id)
        if (error.code === '23505') {
          // Postgres unique_violation error code
          // But for simplicity, returning a general conflict error for the batch
          return res.status(409).json({
            error:
              'Conflict: Some participant attendance records for this activity already exist.',
            details: error.message,
          });
        }
        return res.status(400).json({ error: error.message });
      }
      return res.status(201).json({
        message: 'Attendance records inserted successfully.',
        insertedCount: logsToInsert.length,
        insertedData: data,
      });
    } catch (err) {
      console.error('recordAttendance endpoint error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getActivityWithAttendance(req, res) {
    try {
      const { activityId } = req.params;
      if (!activityId) {
        return res.status(400).json({ error: 'Missing activityId' });
      }
      const { data, error } = await supabase
        .from('activity_schedule')
        .select(
          `
          id,
          name,
          date,
          time_start,
          time_end,
          lead_staff,
          staff,
          volunteers,
          location,
          notes,
          activity_logs:activity_log (
            id,
            participant:participant_id (
              id,
              participant_general_info (
                first_name,
                last_name
              )
            ),
            declined,
            rating,
            notes,
            date
          )
        `
        )
        .eq('id', activityId)
        .single();

      if (error) {
        console.error('Supabase getActivityWithAttendance error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json(data);
    } catch (err) {
      console.error('getActivityWithAttendance error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
  async getAllActivities(req, res) {
    try {
      const { start, end } = req.query;

      let query = supabase
        .from('activity_schedule')
        .select(`*`)
        .order('date', { ascending: true });

      if (start) query = query.gte('date', start);
      if (end) query = query.lte('date', end);

      const { data, error } = await query;
      if (error) {
        console.error('Supabase getAllActivities error:', error);
        return res.status(400).json({ error: error.message });
      }
      return res.status(200).json(data);
    } catch (err) {
      console.error('getAllActivities error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  async addActivity(req, res) {
    try {
      const {
        name,
        date,
        time_start,
        time_end,
        lead_staff,
        staff,
        volunteers,
        location,
        notes,
      } = req.body;

      if (!name || !date || !time_start || !time_end) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { data, error } = await supabase
        .from('activity_schedule')
        .insert([
          {
            name,
            date,
            time_start,
            time_end,
            lead_staff,
            staff,
            volunteers,
            location,
            notes,
          },
        ])
        .select('*')
        .single();

      if (error) {
        console.error('Supabase createActivity error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.status(201).json(data);
    } catch (err) {
      console.error('createActivity error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
  async updateActivity(req, res) {
    try {
      const { activityId } = req.params;
      const {
        name,
        date,
        time_start,
        time_end,
        lead_staff,
        staff,
        volunteers,
        location,
        notes,
      } = req.body;

      if (!activityId) {
        return res.status(400).json({ error: 'Missing activityId' });
      }

      const { data, error } = await supabase
        .from('activity_schedule')
        .update({
          name,
          date,
          time_start,
          time_end,
          lead_staff,
          staff,
          volunteers,
          location,
          notes,
        })
        .eq('id', activityId)
        .select('*')
        .single();

      if (error) {
        console.error('Supabase updateActivity error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json(data);
    } catch (err) {
      console.error('updateActivity error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
  async deleteActivity(req, res) {
    try {
      const { activityId } = req.params;
      if (!activityId) {
        return res.status(400).json({ error: 'Missing activityId' });
      }

      const { error } = await supabase
        .from('activity_schedule')
        .delete()
        .eq('id', activityId)
        .single();

      if (error) {
        console.error('Supabase deleteActivity error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({
        activityId: activityId,
        message: 'Activity deleted successfully',
      });
    } catch (err) {
      console.error('deleteActivity error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
};

module.exports = activitiesController;
