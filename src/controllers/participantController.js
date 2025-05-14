const supabase = require('../config/supabase');

const ParticipantInfoFields = `
  id,
  participant_updated_at,
  participant_created_at,
  participant_general_info(*),
  participant_demographics(*),
  participant_address_and_contact(*),
  participant_marital_status(*),
  carepartners:participant_care_id_fkey (
    primary,
    carepartner:carepartner_id (
      id,
      participant_general_info (
        first_name,
        last_name,
        status
      )
    )
  ),
  participants_cared_for:participant_care_carepartner_id_fkey (
    primary,
    participant:id (
      id,
      participant_general_info (
        first_name,
        last_name,
        status
      )
    )
  ),
  participant_services(*)
`;
const howParticipantInfoFields = `
  id,
  participant_updated_at,
  participant_created_at,
  participant_general_info (*),
  participant_how_data_fields(*),
  participant_how_falls(*),
  participant_how_hospitalization(*),
  participant_how_programs(*),
  participant_how_toileting(*)
`;
const validTables = new Set([
  'participant_general_info',
  'participant_demographics',
  'participant_address_and_contact',
  'participant_marital_status',
  'participant_care',
  'participant_how_data_fields',
  'participant_how_falls',
  'participant_how_hospitalization',
  'participant_how_programs',
  'participant_how_toileting',
  'participant_services',
  'participant_schedule',
]);
const mainParticipantInfoFields = `
  id,
  participant_general_info (
    first_name,
    last_name,
    status,
    type
  )
`;

const participantController = {
  async getParticipants(req, res) {
    try {
      console.log('Fetching participants information');
      const { data, error } = await supabase.from('participants').select(
        `
          ${mainParticipantInfoFields},
          participant_created_at,
          participant_updated_at,
          carepartners:participant_care_id_fkey (
            primary,
            carepartner:carepartner_id (
              ${mainParticipantInfoFields}
            )
          )
        `
      );

      if (error) {
        console.error(error.message);
        return res.status(400).json({ error: error.message });
      }
      if (data) {
        return res.json(data);
      }
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async getCarePartners(req, res) {
    try {
      console.log('Fetching care partners information');
      const { data, error } = await supabase
        .from('participants')
        .select(
          `
          ${mainParticipantInfoFields},
          participants_cared_for:participant_care_carepartner_id_fkey (
            primary,
            participant:id (
              ${mainParticipantInfoFields}
            )
          )
          `
        )
        .eq('participant_general_info.type', 'Care Partner');
      if (error) {
        console.error(error.message);
        return res.status(400).json({ error: error.message });
      }
      if (data) {
        return res.json(data);
      }
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async getParticipantInfo(req, res) {
    try {
      const { participantid } = req.params;
      if (!participantid) {
        return res.status(400).json({ error: 'Participant ID is required' });
      }
      console.log('Fetching participant info:', participantid);
      const { data, error } = await supabase
        .from('participants')
        .select(ParticipantInfoFields)
        .eq('id', participantid)
        .single();

      if (error) {
        console.error(error.message);
        return res.status(400).json({ error: error.message });
      }
      if (data) {
        return res.json(data);
      }
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async getParticipantHOWInfo(req, res) {
    try {
      const { participantid } = req.params;
      if (!participantid) {
        return res.status(400).json({ error: 'Participant ID is required' });
      }
      console.log('Fetching participant info:', participantid);
      const { data, error } = await supabase
        .from('participants')
        .select(howParticipantInfoFields)
        .eq('id', participantid)
        .single();

      if (error) {
        console.error(error.message);
        return res.status(400).json({ error: error.message });
      }
      if (data) {
        return res.json(data);
      }
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async updateParticipant(req, res) {
    let participantId = null; //initialized to null to avoid reference error in catch block
    let updatedTables = []; // initialized to empty array to avoid reference error in catch block
    let updatedData = {}; //keeps track of all the participant's data in the tables that are updated
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Invalid request body' });
      }
      const { participantid } = req.params;
      participantId = participantid;
      if (!participantId) {
        return res.status(400).json({ error: 'Participant ID is required' });
      }
      console.log('Checking if participant exists:', participantId);
      const { data: existingData, error: checkError } = await supabase
        .from('participants')
        .select(`*`)
        .eq('id', participantId)
        .maybeSingle();
      if (checkError) {
        throw checkError;
      }
      if (!existingData) {
        //participant with such id does not exist in participants table
        console.log('Adding participant to participants table', participantId);
        const { data: newParticipant, error: insertError } = await supabase
          .from('participants')
          .insert({ id: participantId })
          .select('id');
        if (insertError) {
          throw insertError;
        }
        if (!newParticipant || newParticipant.length === 0) {
          throw new Error(
            `Failed to insert participant with id ${participantId}`
          );
        }
      }
      for (const [tablename, tabledata] of Object.entries(req.body)) {
        if (!validTables.has(tablename)) {
          return res.status(400).json({ error: `Invalid table: ${tablename}` });
        }
        if (tabledata) {
          if (Object.keys(tabledata).length === 0) continue;
          console.log(
            `Updating the participant data in ${tablename} for ${participantId}`
          );
          const { data, error } = await supabase
            .from(tablename)
            .upsert({ ...tabledata, id: participantId }) //inserts a row if such id is not found in the table and updates it otherwise
            .select('*');
          if (error) {
            throw error;
          }
          if (!data || data.length === 0) {
            throw new Error(`Failed to update ${tablename}`);
          }
          updatedTables.push(tablename); //keeping track of what tables were updated
          updatedData = { ...updatedData, [tablename]: data };
        }
      }
      console.log(
        `Updating participant_updated_at value for participant: ${participantId}`
      );
      const { data: updatedParticipant, error: updatedParticipantError } =
        await supabase
          .from('participants')
          .update({ participant_updated_at: new Date().toISOString() })
          .eq('id', participantId)
          .select('*');
      if (updatedParticipantError) {
        throw updatedParticipantError;
      }
      if (!updatedParticipant || updatedParticipant.length === 0) {
        throw new Error(
          `Failed to update participant_updated_at value at participants table for ${participantId}`
        );
      }
      return res.json({
        updated_data: updatedData,
        updated_tables: updatedTables,
        participantid: participantId,
      });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({
        error: 'Internal server error',
        updated_data: updatedData,
        updated_tables: updatedTables,
        participantid: participantId,
      });
    }
  },
  async deleteParticipant(req, res) {
    try {
      const { participantid } = req.params;
      console.log('Deleting participant:', participantid);
      const { error } = await supabase
        .from('participants')
        .delete()
        .eq('id', participantid)
        .maybeSingle();

      if (error) {
        console.error(error.message);
        return res.status(400).json({ error: error.message });
      }
      return res.status(200).json({
        message: `Participant ${participantid} successfully deleted from the database`,
        participantid: participantid,
      });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async deleteParticipantData(req, res) {
    try {
      const { table, participantid } = req.params;
      if (!table || !participantid) {
        return res.status(400).json({ error: 'ID and table are required' });
      }
      if (!validTables.has(table)) {
        return res.status(400).json({ error: `Invalid table: ${table}` });
      }
      let keyFields = req.body && typeof req.body === 'object' ? req.body : {};
      const isDeleteAll = Object.keys(keyFields).length === 0;

      console.log('Deleting participant data:', participantid);
      console.log(
        `Deleting row(s) from ${table} with key fields ${JSON.stringify(keyFields)}`
      );
      keyFields = { ...keyFields, id: participantid };
      const { error } = await supabase.from(table).delete().match(keyFields);
      if (error) {
        console.error(error.message);
        return res.status(400).json({ error: error.message });
      }
      return res.status(200).json({
        message: isDeleteAll
          ? `All rows for participant deleted`
          : `Row with specified keys deleted`,
        table: table,
        keys: keyFields,
      });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
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
   * Body: { id?, participant_id, date, time, in, out, code }
   */
  async upsertParticipantAttendance(req, res) {
    try {
      const {
        id,
        participant_id,
        date,
        time,
        in: inTime,
        out,
        code,
      } = req.body;
      if (!participant_id || !date || !time) {
        return res
          .status(400)
          .json({ error: 'participant_id, date, and time are required' });
      }
      const { data, error } = await supabase
        .from('participant_attendance')
        .upsert(
          { id, participant_id, date, time, in: inTime, out, code },
          { onConflict: id ? ['id'] : undefined }
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
module.exports = participantController;
