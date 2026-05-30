export const EmailTemplates = {
  invite: (email: string, packTitle: string) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>You've been invited to ${packTitle}!</h2>
      <p>Hello ${email},</p>
      <p>You have been invited to join the <strong>${packTitle}</strong> pack on RocketBoard.</p>
      <a href="https://rocketboard.example.com" style="display: inline-block; background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">Accept Invite</a>
    </div>
  `,
  moduleComplete: (userName: string, moduleTitle: string) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Module Completed! 🎉</h2>
      <p>Great job, ${userName}!</p>
      <p>You've successfully completed the module: <strong>${moduleTitle}</strong>.</p>
      <p>Keep up the great work!</p>
    </div>
  `,
  milestone: (userName: string, milestoneName: string) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>New Milestone Achieved! 🏆</h2>
      <p>Awesome, ${userName}!</p>
      <p>You just reached a new milestone: <strong>${milestoneName}</strong>.</p>
    </div>
  `
};
