import * as Contacts from 'expo-contacts';

import { normalizePhoneForComparison } from './phone';

export type DeviceInviteContact = {
  id: string;
  name: string;
  emails: string[];
  phones: string[];
};

export async function collectDeviceContactLookupPayload() {
  const permission = await Contacts.requestPermissionsAsync();
  return collectDeviceContactLookupPayloadWithPermission(permission.status === 'granted');
}

export async function collectDeviceContactLookupPayloadWithPermission(granted: boolean) {
  if (!granted) {
    return {
      granted: false,
      emails: [] as string[],
      phones: [] as string[],
      contacts: [] as DeviceInviteContact[],
    };
  }

  const response = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
    pageSize: 1000,
  });

  const emailSet = new Set<string>();
  const phoneSet = new Set<string>();
  const contacts: DeviceInviteContact[] = [];

  for (const contact of response.data) {
    const contactEmails: string[] = [];
    const contactPhones: string[] = [];

    for (const email of contact.emails ?? []) {
      const value = email.email?.trim().toLowerCase();
      if (value) {
        emailSet.add(value);
        contactEmails.push(value);
      }
    }

    for (const phone of contact.phoneNumbers ?? []) {
      const normalized = normalizePhoneForComparison(phone.number ?? '');
      if (normalized) {
        phoneSet.add(normalized);
        contactPhones.push(normalized);
      }
    }

    if (contactEmails.length > 0 || contactPhones.length > 0) {
      contacts.push({
        id: contact.id,
        name: contact.name?.trim() || contact.firstName?.trim() || 'Contact',
        emails: contactEmails,
        phones: contactPhones,
      });
    }
  }

  return {
    granted: true,
    emails: Array.from(emailSet),
    phones: Array.from(phoneSet),
    contacts,
  };
}
