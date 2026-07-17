import LegalLayout from "@/components/site/LegalLayout";

const EMAIL = "gdkalyan2109@gmail.com";

export default function Privacy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      description="How GoTogether collects, uses, and protects your information."
      path="/privacy"
      lastUpdated="May 2026"
    >
      <p>
        GoTogether respects your privacy and is designed to help users plan trips, manage friends,
        coordinate live trip updates, and track shared expenses.
      </p>

      <h2>Information we collect</h2>
      <p>We may collect information you provide, such as:</p>
      <ul>
        <li>Your phone number, name, and profile photo</li>
        <li>Trip details, itinerary events, and location-related trip information</li>
        <li>Expense details and shared expense records</li>
        <li>Friend connections and contact matches</li>
        <li>App usage data needed to operate the app</li>
      </ul>

      <h2>How we use your information</h2>
      <ul>
        <li>Create and manage your account and authenticate sign-in</li>
        <li>Show your trips and friends</li>
        <li>Support itinerary and live trip features</li>
        <li>Manage shared expenses</li>
        <li>Send important app notifications</li>
        <li>Improve app reliability and provide customer support</li>
      </ul>

      <h2>Permissions</h2>
      <p>
        GoTogether may request access to contacts, photos, camera/photo library, location, and
        notifications only when needed for app features. You can manage these permissions through
        your device settings at any time.
      </p>

      <h2>Sharing and service providers</h2>
      <p>
        We do not sell your personal information. Some information may be processed by trusted
        service providers used to run the app, such as authentication, hosting, database, storage,
        analytics, and notification services.
      </p>

      <h2>Shared trip visibility</h2>
      <p>
        Shared trip information may be visible to other members of the same trip, including trip
        names, itinerary events, expense details, and related group activity.
      </p>

      <h2>Account deletion</h2>
      <p>
        You can delete your account from the Settings screen in the app. When you delete your
        account, we remove or anonymize your profile information according to our data retention
        needs, while some shared trip records may remain visible to other trip members where needed
        for group history, expense records, or app integrity.
      </p>

      <h2>Contact</h2>
      <p>
        If you need help with privacy questions or account deletion, contact us at{" "}
        <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
      </p>

      <h2>Updates to this policy</h2>
      <p>
        This Privacy Policy may be updated from time to time, and continued use of GoTogether means
        you agree to the updated policy.
      </p>
    </LegalLayout>
  );
}