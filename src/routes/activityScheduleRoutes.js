const express = require('express');
const activitiesScheduleController = require('../controllers/activityScheduleController');

const router = express.Router();

router.get('/activities', activitiesScheduleController.getActivityScheduling);
router.get('/activities/:id', activitiesScheduleController.getActivityById);
router.get(
  '/google-calendar/events',
  activitiesScheduleController.getGoogleCalendarEvents
);
router.post(
  '/sync-to-calendar',
  activitiesScheduleController.syncToGoogleCalendar
);
// router.post('/activities', activitiesScheduleController.createActivity);
// router.put('/activities/:id', activitiesScheduleController.updateActivity);
// router.delete('/activities/:id', activitiesScheduleController.deleteActivity);

module.exports = router;
