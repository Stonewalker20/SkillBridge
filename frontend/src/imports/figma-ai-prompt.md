Below is a precise, production-ready Figma AI prompt tailored to your current SkillBridge architecture (FastAPI + MongoDB backend, React/Vite frontend, authenticated users, job paste → match → tailor flow). This will generate a modern, employer-ready UI aligned with your updated UX direction.

Figma AI Prompt
Design a modern, production-ready web application UI for a SaaS platform called SkillBridge.
SkillBridge is a professional AI-powered resume and skill intelligence platform that allows users to:
* Manage and edit their skills
* Upload and manage portfolio evidence
* Paste job descriptions to receive a real-time match score
* Generate tailored resumes
* Manage their account (login, logout, update profile)
* Admins can moderate content (admin UI must be hidden from normal users)
The design must feel like a high-end professional SaaS product suitable for employers and recruiters.

Design Style
* Clean, minimal, professional SaaS aesthetic
* Light mode primary (optional dark mode variant)
* Subtle depth using soft shadows
* Rounded corners (8–12px)
* Modern typography (Inter or SF Pro style)
* Primary accent color: Deep Blue (#1E3A8A or similar)
* Secondary accent: Teal (#0D9488)
* Neutral grays for structure
* Generous white space
* No clutter
* Smooth dashboard cards
* Polished data visualization components
Avoid:
* Playful or startup-y gradients
* Cartoonish visuals
* Heavy animation
* Overuse of color

Application Structure
Global Layout
* Left sidebar navigation (collapsible)
* Top header bar with:
    * App logo (SkillBridge)
    * Notification icon
    * User avatar dropdown (Account, Logout)
Sidebar links:
* Dashboard
* Skills
* Evidence
* Jobs
* Account (Admin link hidden unless role = admin)

Screen Requirements
1. Dashboard (Main Landing After Login)
Purpose: Overview of user’s skill intelligence.
Include:
* Welcome header with user name
* Summary cards:
    * Total Skills
    * Portfolio Items
    * Average Match Score
    * Tailored Resumes Generated
* Recent Activity panel
* Top Skill Categories (small bar chart or tag cloud)
* Quick Action buttons:
    * Analyze New Job
    * Add Skill
    * Upload Evidence
Design:
* 4-card grid top row
* 2-column layout beneath
* Clean analytics feel

2. Skills Page
Purpose: Add / Modify / Delete skills.
Layout:
* Header: “Manage Skills”
* Search bar
* Filter by category dropdown
* “+ Add Skill” button (modal)
Skill cards should include:
* Skill name
* Category tag
* Aliases (subtle)
* Edit icon
* Delete icon
Add Skill Modal:
* Skill Name
* Category
* Aliases
* Save button
Design:
* Grid or table toggle view
* Clean CRUD SaaS layout

3. Evidence Page
Purpose: Manage portfolio evidence linked to skills.
Layout:
* Upload Evidence button
* Cards with:
    * Project title
    * Associated skills (tag chips)
    * Description preview
    * Edit/Delete icons
Optional:
* Toggle between card view and list view
* Small icon representing evidence type
Design:
* Clean project portfolio aesthetic

4. Jobs Page (Redesigned Core Feature)
This is the primary innovation screen.
Layout:
Header: “Analyze Job Fit”
Top Section:
* Large text area for pasting job description
* Optional fields:
    * Job Title
    * Company
    * Location
* “Analyze Match” primary button
After Analyze:
Display:
* Large circular Match Score (percentage ring)
* Match breakdown section:
    * Matched Skills
    * Missing Skills
    * Strength Areas
* Button: “Generate Tailored Resume”
After Resume Generated:
* Confirmation card
* Buttons:
    * Download PDF
    * Download DOCX
Design:
* Clear flow hierarchy
* Focused, distraction-free layout
* Score circle should be visually dominant

5. Account Page
Layout:
* Profile Card:
    * Username
    * Email
    * Change Email
    * Change Username
    * Change Password
* Logout button
* Danger Zone (Delete Account) styled carefully
Design:
* Clean settings panel
* Two-column centered layout

6. Admin Page (Hidden Role-Based UI)
Visible only if role = admin.
Features:
* User list table
* Skill moderation panel
* Promote/Demote user role
* Flagged content section
Design:
* Professional internal dashboard style
* More dense layout acceptable

UX Behavior Requirements
* Role-based UI visibility
* Clear empty states (No skills yet, No evidence yet)
* Confirmation modals for deletes
* Success toast notifications
* Clean error messaging
* Loading states (skeleton loaders preferred)

Components to Include
Create reusable components:
* Sidebar navigation
* Card component
* Modal component
* Tag/Chip component
* Circular progress score
* Data table
* Toast notification
* Confirmation dialog

Deliverables Format
* Desktop first (1440px)
* Responsive layout versions (Tablet + Mobile)
* Component library page included
* Style guide page included (colors, typography, spacing scale)

Branding Direction
SkillBridge should feel:
* Intelligent
* Professional
* Reliable
* Analytical
* Enterprise-ready
* Suitable for recruiters and technical professionals
It should not feel:
* Like a student project
* Like a generic template
* Overly flashy

