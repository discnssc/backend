const express = require('express');
const scheduleController = require('../controllers/scheduleController');
const router = express.Router();

// Attendance routes
router.get('/attendance', scheduleController.getAllParticipantAttendance);
router.get(
  '/attendance/:participantid',
  scheduleController.getParticipantAttendance
);
router.post('/attendance', scheduleController.upsertParticipantAttendance);
router.delete(
  '/attendance/:id',
  scheduleController.deleteParticipantAttendance
);

// Scheudle routes
router.get('/schedules', scheduleController.getAllParticipantSchedules);
router.get(
  '/schedule/:participantid',
  scheduleController.getParticipantSchedule
);
router.post(
  '/schedule/:participantid',
  scheduleController.upsertParticipantSchedule
);
router.delete(
  '/schedule/:participantid/:month/:year',
  scheduleController.deleteParticipantSchedule
);

module.exports = router;
