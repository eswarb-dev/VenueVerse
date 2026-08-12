<div align="center">

<img src="https://raw.githubusercontent.com/eswarb-dev/VenueVerse/main/Demo/banner.png" alt="VenueVerse Banner" width="760">

<br><br>

<img src="https://raw.githubusercontent.com/eswarb-dev/VenueVerse/main/assets/icon.png" alt="VenueVerse App Logo" width="100">

<br><br>

<h1>VenueVerse</h1>

<p><strong>Campus Venue Booking & Approval System</strong></p>

<br>

<a href="#">
  <img src="https://readme-typing-svg.demolab.com/?font=Fira+Code&weight=600&size=22&pause=1000&color=6C5CE7&center=true&vCenter=true&width=700&lines=Discover+available+campus+venues;Request.+Approve.+Track.;Simplifying+campus+venue+coordination" alt="Typing SVG">
</a>

<br><br>

<img src="https://img.shields.io/github/last-commit/eswarb-dev/VenueVerse?style=for-the-badge&color=6C5CE7&labelColor=1a1a1a" />
<img src="https://img.shields.io/github/languages/top/eswarb-dev/VenueVerse?style=for-the-badge&color=00cec9&labelColor=1a1a1a" />
<img src="https://img.shields.io/github/repo-size/eswarb-dev/VenueVerse?style=for-the-badge&color=fdcb6e&labelColor=1a1a1a" />
<img src="https://img.shields.io/github/stars/eswarb-dev/VenueVerse?style=for-the-badge&color=e17055&labelColor=1a1a1a" />
<img src="https://img.shields.io/badge/platform-Android-3DDC84?style=for-the-badge&logo=android&logoColor=white" />

<br><br>

<a href="https://play.google.com/store/apps/details?id=com.srec.aids.venueverse">
  <img src="https://img.shields.io/badge/Google_Play-View_App-414141?style=for-the-badge&logo=googleplay&logoColor=white" />
</a>

</div>

<br>

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3&section=header" width="100%">

📖 About VenueVerse

VenueVerse is a mobile-first campus venue booking and approval system designed to simplify how institutional halls and shared spaces are discovered, requested, approved, and tracked.

Instead of handling venue coordination through scattered messages or manual records, VenueVerse provides a structured workflow for users to view venues, submit booking requests, follow approval progress, receive status updates, and access booking receipts from one place.

<br>

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3&section=header" width="100%">

✨ Core Features

🏛️ Campus Venue Discovery — browse available halls and venue information

📅 Booking Requests — submit venue requests with event details

✅ Approval Workflow — route bookings through designated department approvers

🔄 Booking Status Tracking — follow requests from submission to approval or rejection

🔔 Push Notifications — receive important booking and approval updates

🧾 Booking Receipts — maintain structured booking confirmation records

👤 Secure User Profiles — authenticated access linked to user accounts

🛡️ Role-Based Data Access — protected backend access using Supabase Row Level Security

📱 Android-First Experience — optimized for mobile campus usage

<br>

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3&section=header" width="100%">

🛠️ Tech Stack

<div align="center">

<img src="https://skillicons.dev/icons?i=react,typescript,supabase,firebase,androidstudio,git,github,vscode&theme=dark" />

</div>

<br>

Layer

Technology

Mobile App

React Native + Expo

Language

TypeScript / JavaScript

Authentication

Supabase Auth

Database

Supabase PostgreSQL

Security

Supabase Row Level Security

Notifications

Firebase Cloud Messaging / Expo Notifications

Android Build

Gradle

Distribution

Google Play Console

Version Control

Git + GitHub

<br>

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3&section=header" width="100%">

🎬 Demo

<div align="center">

▶ Watch the VenueVerse Demo Video

</div>

<br>

🖼️ App Screenshots

<div align="center">

<table>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/eswarb-dev/VenueVerse/main/Demo/1.png" alt="VenueVerse Screenshot 1" width="240"></td>
    <td align="center"><img src="https://raw.githubusercontent.com/eswarb-dev/VenueVerse/main/Demo/2.png" alt="VenueVerse Screenshot 2" width="240"></td>
    <td align="center"><img src="https://raw.githubusercontent.com/eswarb-dev/VenueVerse/main/Demo/3.png" alt="VenueVerse Screenshot 3" width="240"></td>
    <td align="center"><img src="https://raw.githubusercontent.com/eswarb-dev/VenueVerse/main/Demo/4.png" alt="VenueVerse Screenshot 4" width="240"></td>
  </tr>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/eswarb-dev/VenueVerse/main/Demo/5.png" alt="VenueVerse Screenshot 5" width="240"></td>
    <td align="center"><img src="https://raw.githubusercontent.com/eswarb-dev/VenueVerse/main/Demo/6.png" alt="VenueVerse Screenshot 6" width="240"></td>
    <td align="center"><img src="https://raw.githubusercontent.com/eswarb-dev/VenueVerse/main/Demo/7.png" alt="VenueVerse Screenshot 7" width="240"></td>
    <td align="center"><img src="https://raw.githubusercontent.com/eswarb-dev/VenueVerse/main/Demo/8.png" alt="VenueVerse Screenshot 8" width="240"></td>
  </tr>
</table>

</div>

<br>

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3&section=header" width="100%">

🏗️ Architecture

flowchart TD
    A[VenueVerse Mobile App] --> B[Supabase Authentication]
    A --> C[Supabase PostgreSQL]

    C --> D[Profiles]
    C --> E[Halls]
    C --> F[Bookings]
    C --> G[Department Approvers]
    C --> H[Notifications]
    C --> I[Booking Receipts]

    F --> J[Approval Workflow]
    J --> G
    J --> H

    H --> K[Push Notification Delivery]
    K --> L[Firebase / Expo Notifications]

    F --> I

<br>

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3&section=header" width="100%">

🔄 Booking Flow

flowchart LR
    A[Sign In] --> B[Browse Venues]
    B --> C[Select Venue]
    C --> D[Submit Booking Request]
    D --> E[Approver Review]
    E -->|Approved| F[Booking Confirmed]
    E -->|Rejected| G[Request Rejected]
    F --> H[Notification]
    F --> I[Booking Receipt]

<br>

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3&section=header" width="100%">

📂 Project Structure

VenueVerse/
├── android/            # Native Android project and Gradle configuration
├── assets/             # App images, icons and static assets
├── cloudflare/         # Cloud-side utilities/services used by the project
├── docs/               # Project documentation
├── src/                # React Native application source
├── supabase/           # Supabase database/backend configuration
├── App.tsx             # Application entry component
├── app.json            # Expo application configuration
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── .env.example        # Environment-variable template

Sensitive files such as local .env files, signing credentials, passwords, private keys and local secret directories should never be committed to the repository.

<br>

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3&section=header" width="100%">

🚀 Getting Started

1. Clone the repository

git clone https://github.com/eswarb-dev/VenueVerse.git
cd VenueVerse

2. Install dependencies

npm install

3. Configure environment variables

Create your local environment file using the provided template:

cp .env.example .env

Add the required project values locally.

Do not commit .env, signing passwords, service-account credentials, keystores, or other private secrets.

4. Start the development server

npm start

or

npx expo start

<br>

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3&section=header" width="100%">

🤖 Android Release Build

From the Android directory:

cd android
.\gradlew.bat bundleRelease

The generated Android App Bundle is created under:

android/app/build/outputs/bundle/release/

Before publishing a release, verify the version code, signing configuration, lint result, and Play Console compatibility checks.

<br>

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3&section=header" width="100%">

🔐 Security Notes

VenueVerse is designed with repository and backend security in mind.

Environment secrets remain outside Git tracking

Android signing credentials are kept local

Supabase Row Level Security protects database access

Authentication is required for protected application workflows

Sensitive configuration should be supplied through environment variables or secure local configuration

Production credentials should never be embedded directly in application source code

<br>

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3&section=header" width="100%">

🗺️ Roadmap

Core campus venue booking flow

Supabase authentication and database integration

Booking approval workflow

Booking status notifications

Android release build pipeline

Production rollout through Google Play

Expanded booking analytics and reports

Improved venue availability visualization

Additional administrative workflow enhancements

<br>

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3&section=header" width="100%">

📱 Google Play

VenueVerse is distributed through Google Play for Android testing and release management.

Package: com.srec.aids.venueverse

▶ View VenueVerse on Google Play

<br>

👨‍💻 Maintainer

<div align="center">

Built and maintained by eswarb-dev

<br><br>

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" width="100%">

</div>
