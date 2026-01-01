# 🎯 Quick Start - Fresh Database Test

## ✅ Database Reset Complete

The database has been **deleted and recreated fresh**. 

---

## 🚀 What You Should See Now

**On application launch, you should see:**

### Option 1: Setup Wizard ✨
If everything is working correctly, you'll see:
- **"Welcome to Business Manager"** or similar
- **Setup wizard** asking for business information
- First-time configuration screens

👉 **Follow [ONBOARDING_TEST.md](ONBOARDING_TEST.md) starting from Step 1**

### Option 2: Login Page 🔐
If you see the login page instead:
- This means a default admin was created
- Check console logs for default credentials
- Or check the terminal output for admin credentials

---

## 📋 Quick Onboarding Steps

### 1️⃣ **Setup Wizard** (If it appears)
```
Business Name: Ocean View Restaurant
Username:      admin
Password:      Admin123!
Security Q:    What is your favorite city?
Answer:        Miami
```

### 2️⃣ **First Login**
```
Username: admin
Password: Admin123!
```

### 3️⃣ **Verify Dashboard**
- ✅ Shows business name (not "Hotel Manager")
- ✅ Admin badge (👑) displayed
- ✅ All menu items visible

### 4️⃣ **Quick Feature Test**
1. Go to Settings → Change theme
2. Add a product with stock tracking
3. Create a sale → Stock decreases
4. Open shift → Close shift

---

## 🧪 Full Test Plan

For comprehensive testing of all 4 phases:

📖 **See [ONBOARDING_TEST.md](ONBOARDING_TEST.md)** - 20 detailed steps

---

## 🆘 Troubleshooting

### If Setup Wizard doesn't appear:

**Check terminal for default admin:**
The terminal output should show something like:
```
Username: yasinheaven
Password: YHSHotel@2025!
```

Try logging in with those credentials.

### If login fails:

1. Check console logs (F12) for errors
2. Verify password is correct (case-sensitive)
3. Check terminal output for any database errors

### If you want to reset again:

```bash
# Stop the app (Ctrl+C in terminal)
# Delete database
del "c:\Users\DELL\Desktop\hotel-manager\db\hotel.db"
# Restart
npm run tauri dev
```

---

## ✨ Application Status

- **Database:** ✅ Fresh/Empty
- **Application:** ✅ Running on `http://localhost:5173`
- **Backend:** ✅ Compiled successfully
- **Ready for:** 🎯 Complete onboarding test

---

## 📞 Support

**Terminal Output:**
Check the terminal where you ran `npm run tauri dev` for:
- Default admin credentials
- Database initialization messages
- Any error messages

**Console Logs:**
Press F12 in the app window to see:
- Authentication attempts
- API calls
- Error messages

---

## 🎉 Let's Test!

**Look at the application window now!** 

You should see either:
1. **Setup Wizard** → Start with Step 1 in ONBOARDING_TEST.md
2. **Login Page** → Check terminal for default credentials

**Good luck with testing!** 🚀
