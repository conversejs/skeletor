/**
 * A consumer's view of the bundled declarations: subclasses of Model and
 * Collection with narrower types must type-check under `strict: true` and
 * `skipLibCheck: false`. Checked by `npm run check:dts`, never executed.
 */
import { Collection, Model, type ComputedProperties, type ModelOptions } from '@converse/skeletor';

type ContactAttributes = { id: number; name: string; nickname?: string };

class Contact extends Model<ContactAttributes> {
  constructor(attrs: ContactAttributes, options?: ModelOptions) {
    super(attrs, options);
  }
  getDisplayName(): string {
    return this.get('nickname') ?? this.get('name');
  }
  get computed(): ComputedProperties<this> {
    return { label: { deps: ['name', 'nickname'], fn: (m) => m.getDisplayName() } };
  }
}

// `model` and `comparator` overridden as instance properties.
export class Contacts extends Collection<Contact> {
  model = Contact;
  comparator = 'name';
}

// ...as accessors.
export class SortedContacts extends Collection<Contact> {
  get model() {
    return Contact;
  }
  get comparator() {
    return (a: Contact, b: Contact) => a.get('name').localeCompare(b.get('name'));
  }
}

// ...and assigned in the constructor.
export class OtherContacts extends Collection<Contact> {
  constructor() {
    super();
    this.model = Contact;
    this.comparator = 'name';
  }
}

export const fromOptions = new Collection<Contact>([], { model: Contact, comparator: 'name' });

export const contact: Contact | undefined = new Contacts().get(1);
