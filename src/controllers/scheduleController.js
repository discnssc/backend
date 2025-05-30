const supabase = require('../config/supabase');

const scheduleController = {
  async getParticipantSchedules(req, res) {
    try {
      const { participantid } = req.params;
      if (!participantid) {
        return res.status(400).json({ error: 'Participant ID is required' });
      }
      const { data, error } = await supabase
        .from('participant_schedule')
        .select('*')
        .eq('participant_id', participantid);
      if (error) {
        console.error(error.message);
        return res.status(400).json({ error: error.message });
      }
      return res.json(data);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async getAllParticipantSchedules(req, res) {
    try {
      const { data, error } = await supabase
        .from('participant_schedule')
        .select('*');
      if (error) {
        console.error(error.message);
        return res.status(400).json({ error: error.message });
      }
      return res.json(data);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async getParticipantSchedule(req, res) {
    try {
      const { participantid } = req.params;
      const { month, year } = req.query;
      if (!participantid || !month || !year) {
        return res
          .status(400)
          .json({ error: 'Participant ID, month, and year are required' });
      }
      const { data, error } = await supabase
        .from('participant_schedule')
        .select('*')
        .eq('participant_id', participantid)
        .eq('month', month)
        .eq('year', year)
        .single();
      if (error) {
        console.error(error.message);
        return res.status(400).json({ error: error.message });
      }
      return res.json(data);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async upsertParticipantSchedule(req, res) {
    try {
      const { participantid } = req.params;
      const { month, year, schedule, toileting } = req.body;
      if (!participantid || !month || !year || !schedule) {
        return res.status(400).json({
          error: 'Participant ID, month, year, and schedule are required',
        });
      }
      const { data, error } = await supabase
        .from('participant_schedule')
        .upsert(
          { participant_id: participantid, month, year, schedule, toileting },
          { onConflict: ['participant_id', 'month', 'year'] }
        )
        .select('*')
        .single();
      if (error) {
        console.error(error.message);
        return res.status(400).json({ error: error.message });
      }
      return res.json(data);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async deleteParticipantSchedule(req, res) {
    try {
      const { participantid, month, year } = req.params;
      if (!participantid || !month || !year) {
        return res
          .status(400)
          .json({ error: 'Participant ID, month, and year are required' });
      }
      const { error } = await supabase
        .from('participant_schedule')
        .delete()
        .match({ participant_id: participantid, month, year });
      if (error) {
        console.error(error.message);
        return res.status(400).json({ error: error.message });
      }
      return res
        .status(200)
        .json({ message: 'Schedule deleted', participantid, month, year });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  /**
   * Get all attendance records for all participants.
   * GET /participants/attendance
   */
  async getAllParticipantAttendance(req, res) {
    try {
      const { data, error } = await supabase
        .from('participant_attendance')
        .select('*');
      if (error) {
        console.error('Supabase error:', error);
        return res.status(400).json({ error: error.message });
      }
      return res.json(data);
    } catch (error) {
      console.error('Catch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  /**
   * Get all attendance records for a specific participant.
   * GET /participants/attendance/:participantid
   */
  async getParticipantAttendance(req, res) {
    try {
      const { participantid } = req.params;
      if (!participantid) {
        return res.status(400).json({ error: 'Participant ID is required' });
      }
      const { data, error } = await supabase
        .from('participant_attendance')
        .select('*')
        .eq('participant_id', participantid);
      if (error) {
        console.error(error.message);
        return res.status(400).json({ error: error.message });
      }
      return res.json(data);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  /**
   * Upsert (insert or update) an attendance record.
   * POST /participants/attendance
   * Body: { id?, participant_id, date, in, out, code }
   */
  async upsertParticipantAttendance(req, res) {
    try {
      const {
        id,
        participant_id,
        date,
        in: inTime,
        out,
        code,
        session,
      } = req.body;
      if (!participant_id || !date) {
        return res
          .status(400)
          .json({ error: 'participant_id and date are required' });
      }
      const { data, error } = await supabase
        .from('participant_attendance')
        .upsert(
          { id, participant_id, date, in: inTime, out, code, session },
          { onConflict: ['participant_id', 'date'] }
        )
        .select('*')
        .single();
      if (error) {
        console.error(error.message);
        return res.status(400).json({ error: error.message });
      }
      return res.json(data);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  /**
   * Delete an attendance record by id.
   * DELETE /participants/attendance/:id
   */
  async deleteParticipantAttendance(req, res) {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Attendance id is required' });
      }
      const { error } = await supabase
        .from('participant_attendance')
        .delete()
        .eq('id', id);
      if (error) {
        console.error(error.message);
        return res.status(400).json({ error: error.message });
      }
      return res.status(200).json({ message: 'Attendance deleted', id });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};

module.exports = scheduleController;
