const express = require('express');
const activitiesController = require('../controllers/activitiesController');
//const authMiddleware = require('../middleware/authMiddleware'); // <‑‑ don't forget this

const router = express.Router();

/* GET /api/participants/:participantId/activity-logs */
router.get(
  '/:participantId/activity-logs',
  activitiesController.getActivityLogs
);

/* POST /api/participants/:participantId/activity-logs */
router.post(
  '/participants/:participantId/activity-logs',
  activitiesController.createActivityLog
);

/* POST /activities/:activityScheduleId/attendance */
router.post(
  '/:activityScheduleId/attendance',
  activitiesController.recordAttendance
);

module.exports = router; // THIS is what server.js will import
