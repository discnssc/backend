const supabase = require('../config/supabase');
const { google } = require('googleapis');

// Google Calendar API setup
const calendar = google.calendar('v3');
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:5050/oauth2callback'
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const activitiesScheduleController = {
  async getActivityScheduling(_req, res) {
    try {
      const { data, error } = await supabase
        .from('activity_schedule')
        .select(
          'name, time_start, time_end, date, lead_staff, staff, volunteers, location, notes'
        );

      if (error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(200).json(data);
    } catch (error) {
      console.error('Server error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getActivityById(req, res) {
    try {
      const { id } = req.params;

      const { data, error } = await supabase
        .from('activity_schedule')
        .select(
          'name, time_start, time_end, date, lead_staff, staff, volunteers, location, notes'
        )
        .eq('id', id)
        .single();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json(data);
    } catch (error) {
      console.error('Server error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getGoogleCalendarEvents(req, res) {
    try {
      const { data, error } = await supabase
        .from('activity_schedule')
        .select('*');

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      const googleCalendarEvents = data.map((activity) => ({
        summary: activity.name,
        description: `Lead Staff: ${activity.lead_staff || 'N/A'}\nStaff: ${activity.staff || 'N/A'}\nVolunteers: ${activity.volunteers || 'N/A'}\nNotes: ${activity.notes || 'N/A'}`,
        location: activity.location || '',
        start: {
          dateTime: `${activity.date}T${activity.time_start}`,
          timeZone: 'America/New_York',
        },
        end: {
          dateTime: `${activity.date}T${activity.time_end}`,
          timeZone: 'America/New_York',
        },
      }));

      return res.json(googleCalendarEvents);
    } catch (error) {
      console.error('Server error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // NEW: Sync activities to Google Calendar
  async syncToGoogleCalendar(req, res) {
    try {
      // Get activities from database
      const { data, error } = await supabase
        .from('activity_schedule')
        .select('*');

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      // Process each activity and create Google Calendar events
      for (const activity of data) {
        try {
          const event = {
            summary: activity.name,
            description: `Lead Staff: ${activity.lead_staff || 'N/A'}\nStaff: ${activity.staff || 'N/A'}\nVolunteers: ${activity.volunteers || 'N/A'}\nNotes: ${activity.notes || 'N/A'}`,
            location: activity.location || '',
            start: {
              dateTime: `${activity.date}T${activity.time_start}`,
              timeZone: 'America/New_York',
            },
            end: {
              dateTime: `${activity.date}T${activity.time_end}`,
              timeZone: 'America/New_York',
            },
          };

          // Insert event to Google Calendar
          const calendarResponse = await calendar.events.insert({
            auth: oauth2Client,
            calendarId:
              'b7cabec52d660eb660d4db1befd3c91afefa404148c923ebbebf2c2c0b12de55@group.calendar.google.com',
            requestBody: event,
          });

          results.push({
            activity: activity.name,
            status: 'success',
            eventId: calendarResponse.data.id,
          });
          successCount++;
        } catch (eventError) {
          console.error(
            `Error creating event for ${activity.name}:`,
            eventError
          );
          results.push({
            activity: activity.name,
            status: 'error',
            error: eventError.message,
          });
          errorCount++;
        }
      }

      return res.json({
        message: 'Google Calendar sync completed',
        total: data.length,
        success: successCount,
        errors: errorCount,
        results: results,
      });
    } catch (error) {
      console.error('Server error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async insertEventToGoogleCalendar(event) {
    await calendar.events.insert({
      auth: oauth2Client,
      calendarId: 'primary', // or your calendar's ID
      requestBody: event,
    });
  },
};

module.exports = activitiesScheduleController;
