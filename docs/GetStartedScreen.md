**GetStartedScreen**



import 'package:flutter/material.dart';

import 'package:com.srec.venueverse/core/theme/app\_colors.dart';

import 'package:com.srec.venueverse/core/theme/app\_text\_styles.dart';

import 'package:com.srec.venueverse/screens/auth/login\_screen.dart';

import 'package:lottie/lottie.dart';



/// Get Started / Onboarding screen.

///

/// First screen shown to new/logged-out users.

/// Clean institutional design with subtle Lottie animation.

class GetStartedScreen extends StatelessWidget {

&#x20; const GetStartedScreen({super.key});



&#x20; @override

&#x20; Widget build(BuildContext context) {

&#x20;   final height = MediaQuery.of(context).size.height;



&#x20;   return Scaffold(

&#x20;     backgroundColor: AppColors.background,

&#x20;     body: SafeArea(

&#x20;       child: Padding(

&#x20;         padding: const EdgeInsets.symmetric(horizontal: 32),

&#x20;         child: Column(

&#x20;           children: \[

&#x20;             const Spacer(flex: 2),



&#x20;             // ── Illustration ─────────────────────────────

&#x20;             SizedBox(

&#x20;               height: height \* 0.30,

&#x20;               child: Lottie.asset(

&#x20;                 'assets/getstarted.json',

&#x20;                 fit: BoxFit.contain,

&#x20;               ),

&#x20;             ),

&#x20;             const SizedBox(height: 40),



&#x20;             // ── Title ────────────────────────────────────

&#x20;             Text(

&#x20;               'VenueVerse',

&#x20;               style: AppTextStyles.heading1.copyWith(

&#x20;                 fontSize: 32,

&#x20;                 color: AppColors.primary,

&#x20;                 letterSpacing: 1.0,

&#x20;               ),

&#x20;             ),

&#x20;             const SizedBox(height: 12),

&#x20;             Text(

&#x20;               'Campus Venue Booking\\nSimplified.',

&#x20;               style: AppTextStyles.bodyLarge.copyWith(

&#x20;                 color: AppColors.textSecondary,

&#x20;                 height: 1.6,

&#x20;               ),

&#x20;               textAlign: TextAlign.center,

&#x20;             ),



&#x20;             const Spacer(flex: 3),



&#x20;             // ── Get Started Button ───────────────────────

&#x20;             SizedBox(

&#x20;               width: double.infinity,

&#x20;               height: 52,

&#x20;               child: ElevatedButton(

&#x20;                 onPressed: () {

&#x20;                   Navigator.pushReplacement(

&#x20;                     context,

&#x20;                     MaterialPageRoute(

&#x20;                       builder: (context) => const LoginScreen(),

&#x20;                     ),

&#x20;                   );

&#x20;                 },

&#x20;                 style: ElevatedButton.styleFrom(

&#x20;                   backgroundColor: AppColors.primary,

&#x20;                   foregroundColor: AppColors.textOnPrimary,

&#x20;                   elevation: 0,

&#x20;                   shape: RoundedRectangleBorder(

&#x20;                     borderRadius: BorderRadius.circular(14),

&#x20;                   ),

&#x20;                 ),

&#x20;                 child: Text(

&#x20;                   'Get Started',

&#x20;                   style: AppTextStyles.button.copyWith(

&#x20;                     color: AppColors.textOnPrimary,

&#x20;                     fontSize: 16,

&#x20;                   ),

&#x20;                 ),

&#x20;               ),

&#x20;             ),

&#x20;             const SizedBox(height: 40),

&#x20;           ],

&#x20;         ),

&#x20;       ),

&#x20;     ),

&#x20;   );

&#x20; }

}

