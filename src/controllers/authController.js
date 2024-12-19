const supabase = require("../config/supabase");

const authController = {
  async signup(req, res) {
    try {
      const { email, password, username, firstname, lastname } = req.body;

      if (!email || !password || !username) {
        return res.status(400).json({
          error: "Email, password, and username are required",
        });
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        return res.status(400).json({ error: authError.message });
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .insert([
          {
            username,
            email,
            firstname: firstname || null,
            lastname: lastname || null,
          },
        ])
        .select()
        .single();

      if (userError) {
        return res.status(400).json({ error: userError.message });
      }

      res.status(201).json({
        message: "User created successfully",
        user: userData,
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: "Email and password are required",
        });
      }
      console.log("Got email and passwordHash", email, password);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: password,
      });

      if (error) {
        return res.status(401).json({
          error: "Invalid credentials",
        });
      }
      console.log("Got data", data);
      res.cookie("session", data.session.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 3600 * 1000,
        path: "/",
      });

      res.status(200).json({
        message: "Login successful",
        token: data.session.access_token,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  },

  async getMe(req, res) {
    try {
      const token = req.cookies.session;
      console.log("GetMe called with token:", token ? "present" : "missing");

      if (!token) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser(token);

      console.log("GetMe Supabase auth result:", { user, error: userError });

      if (userError || !user) {
        return res.status(401).json({ error: "Authentication failed" });
      }

      const { data: userData, error: dbError } = await supabase
        .from("users")
        .select("id, username, email, firstname, lastname")
        .eq("email", user.email)
        .single();

      console.log("GetMe database query result:", { userData, error: dbError });

      if (userData && !dbError) {
        return res.json(userData);
      }

      return res.json({
        id: user.id,
        email: user.email,
        username: user.email.split("@")[0],
      });
    } catch (error) {
      console.error("ME endpoint error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  },

  async logout(req, res) {
    res.clearCookie("session");
    await supabase.auth.signOut();
    res.json({ message: "Logged out successfully" });
  },

  async verifyEmail(req, res) {
    try {
      const { token_hash, type } = req.query;

      if (!token_hash || type !== "signup") {
        return res.redirect(
          `${process.env.FRONTEND_URL}/auth/callback?error=invalid_verification`
        );
      }

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type: "signup",
      });

      if (error) {
        return res.redirect(
          `${process.env.FRONTEND_URL}/auth/callback?error=${encodeURIComponent(
            error.message
          )}`
        );
      }

      const queryParams = new URLSearchParams({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        type: "signup",
      });

      return res.redirect(
        `${process.env.FRONTEND_URL}/auth/callback?${queryParams.toString()}`
      );
    } catch (error) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/auth/callback?error=server_error`
      );
    }
  },
  async getAllUsers(req, res) {
    try {
      const { data: users, error } = await supabase
        .from("users")
        .select("username, email, firstname, lastn1ame")
        .order("username", { ascending: true });

      if (error) {
        console.error("Error fetching users:", error);
        return res.status(400).json({ error: error.message });
      }

      res.status(200).json(users);
    } catch (error) {
      console.error("Get all users error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async googleAuth(req, res) {
    try {
      console.log("Starting Google auth");
      const {
        data: { url },
        error,
      } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${process.env.FRONTEND_URL}/auth/callback`,
        },
      });

      if (error) throw error;

      console.log("Generated OAuth URL:", url);
      res.json({ url });
    } catch (error) {
      console.error("Google auth error:", error);
      res.status(500).json({ error: "Failed to initialize Google auth" });
    }
  },
  async handleOAuthCallback(req, res) {
    try {
      console.log("OAuth callback received:", req.query);
      const { code } = req.query;

      if (!code) {
        throw new Error("No code provided");
      }

      const { data, error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) throw exchangeError;

      const { session, user } = data;
      console.log("Got user:", user.email);

      const { data: existingUser, error: queryError } = await supabase
        .from("users")
        .select("*")
        .eq("email", user.email)
        .single();

      if (queryError && queryError.code !== "PGRST116") {
        console.error("Error checking for existing user:", queryError);
        throw queryError;
      }

      if (!existingUser) {
        console.log("Creating new user in users table...");
        const newUser = {
          username: user.email.split("@")[0],
          email: user.email,
          firstname: user.user_metadata?.given_name || null,
          lastname: user.user_metadata?.family_name || null,
        };

        const { data: insertedUser, error: insertError } = await supabase
          .from("users")
          .insert([newUser])
          .select()
          .single();

        if (insertError) {
          console.error("Error creating user:", insertError);
          throw insertError;
        }

        console.log("Successfully created new user:", insertedUser);
      } else {
        console.log("Existing user found:", existingUser);
      }

      res.cookie("session", session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 3600 * 1000,
        path: "/",
      });

      res.redirect(`${process.env.FRONTEND_URL}`);
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.redirect(
        `${process.env.FRONTEND_URL}/login?error=` +
          encodeURIComponent(error.message)
      );
    }
  },
  async handleToken(req, res) {
    try {
      const { access_token } = req.body;
      console.log("Received access token in handleToken");

      if (!access_token) {
        return res.status(400).json({ error: "No access token provided" });
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser(access_token);

      if (userError) {
        console.error("Error getting user:", userError);
        throw userError;
      }

      console.log("Got user data:", user.email);

      const { data: existingUser, error: existingUserError } = await supabase
        .from("users")
        .select("*")
        .eq("email", user.email)
        .single();

      console.log("Existing user check:", {
        exists: !!existingUser,
        error: existingUserError,
      });

      if (!existingUser && existingUserError?.code === "PGRST116") {
        console.log("Creating new user in database...");
        const newUser = {
          username: user.email.split("@")[0],
          email: user.email,
          firstname:
            user.user_metadata?.given_name ||
            user.user_metadata?.name?.split(" ")[0] ||
            null,
          lastname:
            user.user_metadata?.family_name ||
            user.user_metadata?.name?.split(" ")[1] ||
            null,
        };

        const { data: insertedUser, error: insertError } = await supabase
          .from("users")
          .insert([newUser])
          .select()
          .single();

        if (insertError) {
          console.error("Error creating user:", insertError);
          throw insertError;
        }

        console.log("Successfully created new user:", insertedUser);
      }

      res.cookie("session", access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 3600 * 1000,
        path: "/",
      });

      console.log("Set session cookie, sending response");
      res.json({ success: true });
    } catch (error) {
      console.error("Token handling error:", error);
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = authController;
