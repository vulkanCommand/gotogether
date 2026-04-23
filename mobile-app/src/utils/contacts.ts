import * as Contacts from 'expo-contacts';

export async function collectDeviceContactLookupPayload() {
  const permission = await Contacts.requestPermissionsAsync();
  if (permission.status !== 'granted') {
    return {
      granted: false,
      emails: [] as string[],
      phones: [] as string[],
    };
  }

  const response = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
    pageSize: 1000,
  });

  const emailSet = new Set<string>();
  const phoneSet = new Set<string>();

  for (const contact of response.data) {
    for (const email of contact.emails ?? []) {
      const value = email.email?.trim().toLowerCase();
      if (value) {
        emailSet.add(value);
      }
    }

    for (const phone of contact.phoneNumbers ?? []) {
      const digits = (phone.number ?? '').replace(/\D+/g, '');
      if (digits) {
        phoneSet.add(digits.length === 10 ? `1${digits}` : digits);
      }
    }
  }

  return {
    granted: true,
    emails: Array.from(emailSet),
    phones: Array.from(phoneSet),
  };
}
