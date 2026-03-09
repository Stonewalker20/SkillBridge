# SkillBridge Midterm Demo Walkthrough

This walkthrough is the practical checklist for the live demo, the recording, and the screenshots you need for the report and slides.

## 1. What You Need Ready Before You Start

Prepare these before you record or present:

- Backend running locally
- Frontend running locally
- MongoDB running with real project data
- One standard user account
- One admin or owner account
- At least:
  - 3 to 5 evidence items
  - 5 or more confirmed skills
  - 2 or more analyzed jobs
  - 1 or more tailored resumes
  - 1 or more submitted jobs to moderate in admin

## 2. Suggested Demo Order

Use this exact order. It is efficient and matches the report structure.

1. Landing page and project description
2. Login as a standard user
3. Dashboard
4. Skills page
5. Evidence page
6. Job Match page
7. Tailored Resumes page
8. Account settings
9. Logout
10. Login as admin or owner
11. Admin Workspace

## 3. Standard User Demo Script

### A. Landing Page

Say:

> SkillBridge is a career intelligence platform that helps users turn resumes, projects, coursework, and other evidence into a structured skill profile. The system then compares that profile to job postings, identifies gaps, and generates tailored resumes.

Show:

- project logo
- landing page layout
- modern responsive UI

Screenshot to capture:

- full landing page hero

### B. Login

Log in as a standard user.

Say:

> Standard users can manage their evidence, skills, analytics, job matching, resumes, and account preferences.

Screenshot to capture:

- login page

### C. Dashboard

Show:

- total skills
- evidence count
- average match score
- tailored resumes count
- recent activity
- top skill categories
- portfolio-to-job analytics

Say:

> The dashboard gives the user a high-level overview of their profile health, recent actions, skill distribution, and job-match readiness.

Screenshots to capture:

- dashboard top section
- recent activity
- top skill categories
- portfolio/job analytics

### D. Skills Page

Show:

- confirmed skills
- proficiency values
- skills with evidence
- skills without evidence
- add custom skill
- delete removable skill

Then perform:

1. Show confirmed skill list
2. Change one skill proficiency
3. Add one custom skill if needed

Say:

> The Skills subsystem allows the user to maintain a structured profile of confirmed skills, control proficiency, and separate evidence-backed skills from unsupported ones.

Screenshots to capture:

- skills page top
- a few visible skill cards
- confirmed without evidence section

### E. Evidence Page

Show:

- existing evidence library
- evidence summary cards
- add evidence modal
- extracted skills review

Then perform:

1. Open Add Evidence
2. Paste evidence text or upload a file
3. Click Analyze Skills
4. Show extracted skills
5. Save the evidence

Say:

> The Evidence subsystem allows the user to upload or paste proof of work, run skill extraction, review the extracted results, and save the evidence only after approval.

Screenshots to capture:

- evidence library
- add evidence modal
- extracted skill review panel

### F. Job Match Page

Show:

- job description input
- last analyzed jobs

Then perform:

1. Paste a realistic job description
2. Click Analyze Job Match
3. Show:
   - match score
   - required skills covered
   - matched skills
   - missing skills
   - semantic alignment
   - personal skill vector
   - retrieved evidence
   - score breakdown
   - gap reasoning
4. Remove one matched or missing skill if that feature is populated
5. Show saved analysis history

Say:

> This subsystem compares the user’s real evidence-backed profile to a target job posting. It calculates coverage, semantic alignment, missing skills, and gap reasoning, then stores the analysis in history.

Screenshots to capture:

- job input screen
- completed job analysis
- gap reasoning section
- saved job history section

### G. Tailored Resume

From Job Match:

1. Choose resume source
2. Generate PDF

Then open Tailored Resumes page and show:

- saved tailored resume cards
- attached job
- resume list

Say:

> Based on the job analysis, SkillBridge generates a tailored resume using either the user’s existing resume data or the default template structure.

Screenshots to capture:

- tailored resume generation controls
- tailored resumes page

### H. Account Settings

Show:

- username/email settings
- AI settings
- header style editor
- profile icon customization

Then perform:

1. Choose a different avatar preset or upload a profile image
2. Show that the top-right profile icon updates

Say:

> The account page lets the user manage profile data, change AI preferences, customize header themes, and update the profile icon.

Screenshots to capture:

- account settings header
- profile icon customization section

## 4. Admin Demo Script

Logout and log in with an admin or owner account.

### A. Admin Workspace

Show:

- admin summary
- user list
- role changes
- pending jobs
- moderation actions

Then perform:

1. Open Admin page
2. Show system summary cards
3. Show user table
4. Change one user role if safe
5. Open pending jobs
6. Approve or reject one job

Say:

> The Admin subsystem is only visible to privileged users. It supports user-role management, moderation, and system-level monitoring.

Screenshots to capture:

- admin workspace hero
- user table
- job moderation table

## 5. Required Report Screenshot Checklist

Capture these for the report:

- Landing page
- Login page
- Dashboard
- Skills page
- Evidence page
- Evidence analyze modal
- Job Match input screen
- Job Match result screen
- Tailored Resumes page
- Account settings page
- Admin workspace
- MongoDB screenshots for:
  - users
  - skills
  - evidence
  - jobs
  - job_match_runs
  - tailored_resumes

## 6. Required Diagram Checklist

You still need to create these outside the codebase:

- Standard user use case diagram
- Admin use case diagram
- One activity diagram for Analyze Job Match
- SSD for each team member feature
- ERD
- One code flowchart per member

## 7. 5-10 Minute Video Recording Plan

If you want to keep the video concise, use this order:

1. Landing page overview
2. Login
3. Dashboard
4. Skills
5. Evidence analyze and save
6. Job Match analysis
7. Tailored resume generation
8. Account settings avatar update
9. Admin workspace

That sequence is enough to cover the running features without wasting time.

## 8. Presentation Tips for March 9 / 11

- Decide who talks through each subsystem in advance
- Do not switch randomly between pages
- Keep one browser window and one seed dataset ready
- Do not rely on live typing for everything if time is short
- Have one prepared job description and one prepared evidence text ready to paste
- If the AI model loads slowly, preload the backend before class

## 9. Commands to Run Before Demo

Backend:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm run dev
```

Optional backend verification:

```bash
cd backend
pytest -q
```

## 10. Final Pre-Demo Checklist

Before presenting, confirm:

- standard user can log in
- admin user can log in
- dashboard loads
- evidence analyze works
- skills page loads confirmed skills
- job match runs successfully
- tailored resume PDF generates
- admin moderation loads
- screenshots are already saved
- diagrams are ready in slides/report
