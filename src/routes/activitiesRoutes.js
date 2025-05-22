const express = require('express');
const activitiesController = require('../controllers/activitiesController');
//const authMiddleware = require('../middleware/authMiddleware'); // <‑‑ don't forget this

const router = express.Router();

/* GET /api/participants/:participantId/activity-logs */
router.get(
  '/:participantId/activity-logs',
  activitiesController.getActivityLogs
);
/* GET /api/activities/:activityScheduleId */
router.get('/:activityId', activitiesController.getActivityWithAttendance);

/* POST /api/participants/:participantId/activity-logs */
router.post(
  '/participants/:participantId/activity-logs',
  activitiesController.createActivityLog
);

/* PUT /activities/:activityScheduleId/attendance */
router.put('/:activityId/attendance', activitiesController.recordAttendance);

module.exports = router; // THIS is what server.js will import
