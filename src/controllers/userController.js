const supabase = require('../config/supabase');

const UserInfoFields = `
  id,
  username, 
  email,
  firstname,
  lastname,
  created_at,
  updated_at
`;

const userController = {
  async getUsers(req, res) {
    try {
      console.log('Fetching users...');
      const { data, error } = await supabase
        .from('users')
        .select(UserInfoFields);

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
};

module.exports = userController;
