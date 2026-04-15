# Daily Tracker - Personal Productivity & Fitness PWA

A powerful all-in-one Progressive Web App for tracking daily tasks, workouts, courses, mood, and personal records. Built with vanilla HTML, CSS, and JavaScript.

## Features
<img width="404" height="676" alt="Screenshot 2026-04-15 at 1 42 42 PM" src="https://github.com/user-attachments/assets/8b2d9e2b-3abe-49f8-9d04-9b63ef711ceb" />
<img width="403" height="558" alt="Screenshot 2026-04-15 at 1 43 23 PM" src="https://github.com/user-attachments/assets/6baa752d-45d4-4281-9746-48e6de6ef267" />
<img width="413" height="706" alt="Screenshot 2026-04-15 at 1 43 00 PM" src="https://github.com/user-attachments/assets/0c8fe933-4ec8-47c5-9956-9c9163550b57" />

### 📋 Task Tracker
- **Recurring Tasks** - Set tasks to repeat on specific days of the week
- **One-time Tasks** - Add tasks for specific dates only
- **Visual Calendar** - See completion percentages at a glance with color-coded indicators
- **Streak Tracking** - Track your consecutive days of 100% task completion
- **Progress Bars** - Visual feedback on daily completion rates

### 💪 Gym & Workout Tracker
- **Exercise Library** - Add exercises with custom sets, reps, and weights
- **Category System** - Organize by Push, Pull, Legs, Core, or Cardio
- **Recurring Workouts** - Schedule exercises on specific days of the week
- **Personal Records** - Track your best lifts per exercise
- **Volume Statistics** - See total weight lifted, sets completed, and workout days (last 30 days)
- **Rest Timer** - Built-in 15-second increment timer between sets
- **One-off Exercises** - Add exercises for specific days only

### 📚 Course Manager
- **Multi-Task Courses** - Each course can have multiple tasks with different recurrence patterns
- **Recurrence Options** - Daily, Weekly (select days), or Once (specific date)
- **Course Dashboard** - Expand/collapse courses to see today's tasks
- **Quick Add Tasks** - Add new tasks directly from the course view
- **Tracker Integration** - Course tasks automatically appear in the main tracker

### 😊 Mood Tracker (Happiness)
- **1-10 Rating Scale** - Rate your daily mood with emojis
- **Date Selection** - Rate any past or future date
- **Mood History** - See your mood progression over time
- **Statistics** - Average mood, best day, total days rated
- **Calendar Integration** - Mood emojis appear on the main calendar

### 📊 Progress Analytics
- **Personal Records** - View all your best lifts sorted by weight
- **Volume Stats** - Track total weight lifted in the last 30 days
- **Exercise History** - See detailed history for any exercise

### 📝 Daily Notes
- **Journal Entry** - Write notes for each day
- **Edit/Save/Cancel** - Full note editing functionality
- **Persistent Storage** - Notes saved per date

### 💾 Data Management
- **Local Storage** - All data saved automatically in your browser
- **Export/Import** - Backup and restore all your data (tasks, gym logs, courses, mood ratings)
- **JSON Format** - Human-readable backup files

## 🚀 Installation

### As a PWA (Recommended)
1. Open the app in Chrome, Edge, or Safari
2. Click the install icon in the address bar
3. Or use the browser menu → "Install app"
4. The app will install to your home screen/launcher

### Local Development
1. Clone or download the repository
2. Open the folder in VS Code
3. Right-click `index.html` and select "Open with Live Server"
4. Or use any HTTP server (Python: `python -m http.server 8000`)


## 🎮 Usage Guide

### Task Tracker
1. **Add a task** - Type task name, select repeat days (optional), click Add
2. **Complete tasks** - Click the circle next to any task
3. **Navigate calendar** - Use ◀ ▶ buttons to change months
4. **Delete tasks** - Hover over a task and click the ✕ button

### Gym Tracker
1. **Add exercise** - Enter name, select category, choose side (barbell/dumbbell), set default reps/weight
2. **Schedule recurrence** - Select days for recurring exercises or leave blank for one-off
3. **Log sets** - Enter reps and weight, click circle to mark as done
4. **Add sets** - Click "+ add set" to add more sets to an exercise
5. **Use rest timer** - Adjust time (±15s), click start, timer counts down

### Courses
1. **Create course** - Click "+ New Course", enter course name
2. **Add tasks** - Enter task name, choose recurrence (daily/weekly/once)
3. **For weekly tasks** - Select which days of the week
4. **For once tasks** - Pick a specific date
5. **Complete tasks** - Click circles in course view or tracker tab
6. **Edit course** - Click ✎ on any course to modify tasks

### Mood Tracking
1. **Select date** - Use date picker to choose a day
2. **Rate your mood** - Click 1-10 with emojis
3. **Edit previous days** - Click ✎ next to any history entry
4. **View stats** - See average mood and best day

### Notes
1. **Click Edit** below your tasks
2. **Write your note** (supports line breaks)
3. **Click Save** to keep or Cancel to discard

## 🎨 Color Zones

Tasks completion percentages are color-coded:
- **0%** - Dark gray
- **1-24%** - Red
- **25-49%** - Orange  
- **50-74%** - Brown
- **75-99%** - Green
- **100%** - Teal

## 💾 Data Backup

### Export
1. Click "📤 Export Data" at the bottom
2. Save the JSON file to a safe location

### Import
1. Click "📥 Import Data"
2. Select a previously exported JSON file
3. Confirm to replace all current data

## 🔧 Browser Compatibility

- Chrome/Edge (recommended for best PWA experience)
- Firefox
- Safari
- Any modern browser with localStorage support

## 📱 PWA Features

- **Offline Support** - Works without internet connection
- **Installable** - Can be installed as a native app
- **Home Screen Icon** - Custom app icon
- **Standalone Mode** - Opens in its own window

## 🛠️ Customization

### Adding Default Data
Default tasks and exercises are loaded on first run. Edit the `initializeApp()` function in `script.js` to change defaults.

### Styling
All colors use CSS variables in `style.css`. Modify the `:root` section to change the theme:

```css
:root {
  --bg: #0f0f0f;
  --surface: #1a1a1a;
  --teal: #1D9E75;
  --red: #E24B4A;
  /* etc... */
}
