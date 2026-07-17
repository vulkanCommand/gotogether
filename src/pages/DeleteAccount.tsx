import LegalLayout from "@/components/site/LegalLayout";

const EMAIL = "gdkalyan2109@gmail.com";

export default function DeleteAccount() {
  return (
    <LegalLayout
      title="Delete your account"
      description="How to delete your GoTogether account and what happens to your data."
      path="/delete-account"
      lastUpdated="May 2026"
    >
      <p>
        You can delete your GoTogether account directly inside the app.
      </p>

      <h2>Delete from the app</h2>
      <ul>
        <li>Open GoTogether on your device</li>
        <li>Go to <strong>Profile</strong> or <strong>Settings</strong></li>
        <li>Select <strong>Delete Account</strong> and confirm</li>
      </ul>

      <h2>What gets removed</h2>
      <p>
        When you delete your account, GoTogether removes or anonymizes your profile information,
        sign-in identity, phone number, email, username, and profile photo according to our Privacy
        Policy.
      </p>

      <h2>What may remain</h2>
      <p>
        Some shared trip information, expenses, or itinerary records may remain visible to other
        trip members where needed for group history, expense records, or app integrity.
      </p>

      <h2>Need help?</h2>
      <p>
        If you cannot access the app or need help deleting your account and associated data,
        contact us at <a href={`mailto:${EMAIL}`}>{EMAIL}</a> with the phone number used for your
        GoTogether account. We usually respond within 24 to 48 hours.
      </p>
    </LegalLayout>
  );
}