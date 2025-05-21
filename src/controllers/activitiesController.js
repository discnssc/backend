const supabase = require('../config/supabase');

/**
 * GET /participants/:participantId/activity-logs
 * Fetches activity logs for a specific participant.
 * Optional query params:
 *   ?month=3&year=2025               → logs for March-2025 (Monthly Report)
 *   ?start=2024-12-01&end=2025-03-31 → logs between dates inclusive (Aggregate)
 */
async function getActivityLogs(req, res) {
  try {
    const { participantId } = req.params;
    if (!participantId) {
      return res.status(400).json({ error: 'Missing participantId' });
    }

    const { month, year, start, end } = req.query;

    let query = supabase
      .from('activity_log')
      // Select specific fields, including the date column (assuming it's "Date")
      // and potentially joining related data like activity name or participant name
      .select(
        `
        id,
        "Date", // Assuming "Date" is the column name for the activity date in activity_log
        declined,
        rating,
        notes, // Assuming 'notes' column exists now
        // Optional: Join activity schedule name if needed
        schedule:activity_schedule_id ( Name ), // Assuming 'Name' is the column name in activity_schedule
        // Optional: Join participant details if needed (less common for a list already filtered by participant)
        // participant:participant_id ( participant_general_info ( first_name, last_name ) )
      `
      )
      .eq('participant_id', participantId)
      // Order by the date column (assuming it's "Date")
      .order('Date', { ascending: false });

    // Monthly filter takes priority over start/end if both provided
    if (month && year) {
      // Create start and end dates for the month
      const startDate = new Date(year, month - 1, 1); // month is 0-based in JS
      const endDate = new Date(year, month, 0); // last day of the month

      // Format dates as YYYY-MM-DD
      const startISO = startDate.toISOString().split('T')[0];
      const endISO = endDate.toISOString().split('T')[0];

      query = query.gte('Date', startISO).lte('Date', endISO);
    } else if (start && end) {
      query = query
        .gte('Date', start) // YYYY-MM-DD format expected from query params
        .lte('Date', end);
    }

    /* 3. execute */
    const { data: logs, error } = await query;

    if (error) {
      console.error('Supabase GET logs error:', error);
      return res.status(400).json({ error: error.message });
    }

    /* 4. success */
    return res.status(200).json(logs); // [] if none
  } catch (err) {
    console.error('getActivityLogs error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

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
async function createActivityLog(req, res) {
  try {
    const { participantId } = req.params;
    const { activity_schedule_id, declined, rating, notes } = req.body;

    // Validate required fields
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
          rating: rating || null, // Default to null if not provided
          notes: notes || null, // Default to null if not provided
        },
      ])
      .select(
        `id, "Date", participant_id, activity_schedule_id, declined, rating, notes`
      ) // Select inserted fields for confirmation
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
}

/**
 * POST /activities/:activityScheduleId/attendance
 * Records attendance and details for multiple participants for a specific scheduled activity.
 * Request body should be a JSON array of participant attendance objects:
 * [
 *   {
 *     "first_name": "Jimmy", // Participant's first name
 *     "last_name": "Jones",  // Participant's last name
 *     "declined": false, // boolean, optional
 *     "rating": 5,       // number, optional
 *     "notes": "..."     // text, optional
 *   },
 *   // ... more participant entries
 * ]
 * This function will look up participant_id by name before inserting.
 */
async function recordAttendance(req, res) {
  try {
    const { activityScheduleId } = req.params; // Get scheduled activity ID from URL
    const participantAttendance = req.body; // Get array of attendance data (with names)

    if (!activityScheduleId) {
      return res
        .status(400)
        .json({ error: 'Missing activityScheduleId in URL' });
    }

    if (
      !Array.isArray(participantAttendance) ||
      participantAttendance.length === 0
    ) {
      return res.status(400).json({
        error:
          'Request body must be a non-empty array of participant attendance data with first_name and last_name.',
      });
    }

    const logsToInsert = [];
    const errors = [];

    // Use Promise.all to handle asynchronous lookups efficiently
    await Promise.all(
      participantAttendance.map(async (attendanceEntry, index) => {
        const { first_name, last_name, declined, rating, notes } =
          attendanceEntry;

        if (!first_name || !last_name) {
          errors.push(`Entry ${index}: Missing first_name or last_name.`);
          console.warn(
            'Skipping attendance entry due to missing name:',
            attendanceEntry
          );
          return; // Skip this entry in logsToInsert, add to errors
        }

        // 1. Look up participant_id based on name
        // Assuming participant_general_info is a table linked to 'participants'
        // and first_name/last_name are columns within participant_general_info.
        // Adjust the 'from' table and 'select' path if needed based on your schema.
        const { data: participantData, error: participantError } =
          await supabase
            .from('participant_general_info') // Assuming names are stored here
            .select('id') // Select the 'id' column from participant_general_info (which links to participants.id)
            .eq('first_name', first_name)
            .eq('last_name', last_name)
            .single(); // Expecting only one match

        if (participantError || !participantData) {
          errors.push(
            `Entry ${index}: Participant not found or lookup failed for ${first_name} ${last_name}.`
          );
          console.error(
            `Participant lookup failed for ${first_name} ${last_name}:`,
            participantError?.message || 'Not found'
          );
          return; // Skip this entry
        }

        const participantId = participantData.id; // Get the 'id' from the lookup result

        // 2. Prepare log entry for insertion
        logsToInsert.push({
          activity_schedule_id: activityScheduleId, // Link to the scheduled activity
          participant_id: participantId,
          declined: declined || false, // Default to false if not provided
          rating: rating || null, // Default to null if not provided
          notes: notes || null, // Default to null if not provided
          // "Date" is expected to be set by the DB trigger based on activity_schedule.Date
          // created_at is set by DB default (now())
        });
      })
    ); // End Promise.all map

    if (logsToInsert.length === 0) {
      // If no valid logs were prepared after processing all entries
      if (errors.length > 0) {
        return res
          .status(400)
          .json({ error: 'No valid logs to insert.', details: errors });
      }
      return res.status(400).json({
        error:
          'No valid participant attendance data provided or no matching participants found.',
      });
    }

    // 3. Insert multiple rows into activity_log
    // No select needed if just confirming insertion
    const { error } = await supabase.from('activity_log').insert(logsToInsert);
    // .select('*'); // Optionally select inserted rows if needed in the response

    if (error) {
      console.error('Supabase bulk insertion error:', error);
      // Check for unique constraint violation (composite PK: activity_schedule_id, participant_id)
      if (error.code === '23505') {
        // Postgres unique_violation error code
        // Can try to insert one by one here and return details about conflicts
        // But for simplicity, returning a general conflict error for the batch
        return res.status(409).json({
          error:
            'Conflict: Some participant attendance records for this activity already exist.',
          details: error.message, // Include DB error message for debugging
        });
      }
      return res.status(400).json({ error: error.message });
    }

    // Success: Return the inserted data or a success message
    // If using .select('*') above, return data directly.
    // Otherwise, return a success message and the number of inserted rows.
    return res.status(201).json({
      message: 'Attendance records inserted successfully.',
      insertedCount: logsToInsert.length,
    });
  } catch (err) {
    console.error('recordAttendance endpoint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Export all functions that need to be used by route files
module.exports = {
  getActivityLogs, // Used by participantRoutes
  createActivityLog, // Used by participantRoutes
  recordAttendance, // Used by activitiesRoutes
};

// Any code below module.exports will not be accessible from other files.
