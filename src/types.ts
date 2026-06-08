// TypeScript Interfaces for multi-user multi-tenant scraping system

export type ProviderType = 'parent' | 'source';

export interface ShippingProvider {
  id: string; // Unique configuration template identifier (e.g., 'hawk', 'jood', 'shaya')
  name: string; // Printable display name of the shipping company
  type: ProviderType; // 'parent' (like Hawks) or 'source' (like Aljood/Shaya)
  loginUrl: string; // System login endpoint
  searchUrl: string; // Advanced search/filtering endpoint
  loginCheck: string; // Keyword found in response indicating a successful login state (e.g., 'logout')
  
  // Selectors used in dynamic page parsing (Axios + Cheerio)
  rowSelector?: string; // CSS selector of order rows (default: 'tr[id]')
  checkboxSelector?: string; // CSS Selector for active ID input (default: 'input[type="checkbox"][name="id[]"]')
  idWaslIndex?: number; // Zero-based cell index of idWasl column inside row (default: Hawk specific)
  sequenceIndex?: number; // Zero-based cell index of Sequence number column inside row (default: Hawk specific)
  columns?: string[]; // Array of strings representing data columns for table parsing (Jood/Shaya mapping)
}

export interface Shortcut {
  id: string;
  name: string;
  color?: string;
  settings: {
    keyword: string;
    statusCode: string;
    joodMode: string;
    autoRange: string;
    singleDate: string;
    startDate: string;
    endDate: string;
    searchSource: string;
  };
}

export interface UserConfig {
  uid: string; // Target unique user account identifier
  username: string; // Handle/username used when logging into our platform
  password: string; // Credentials used when logging into our platform
  role: 'admin' | 'mudhaddith'; // Multi-user privileges control
  parentProviderId: string; // Designated default parent company link (e.g. 'hawk')
  sourceProviderIds: string[]; // Mapped array of designated sources this user can query from (e.g. ['jood', 'shaya'])
  shortcuts?: Shortcut[]; // Custom shortcuts for the user
  
  // User's specific credentials for logging into the shipping lines
  parentCredentials: {
    username: string;
    password: string;
  };
  sourceCredentials: {
    [providerId: string]: {
      username: string;
      password: string;
    };
  };
  
  createdAt?: string;
  updatedAt?: string;
  presence?: UserPresence;
  subscription?: UserSubscription;
}

export interface UserSubscription {
  status: 'active' | 'expired' | 'trial' | 'canceled';
  expiresAt: string; // YYYY-MM-DD
  subscribedAt?: string; // YYYY-MM-DD (start of current cycle)
  trialDays?: number; // active trial days setup
  pricePaid?: number; // subscription cycle price
  notes?: string;
}

export interface UserPresence {
  lastActiveAt?: string; // ISO date-time of last pulse
  todayDate?: string;    // YYYY-MM-DD local style
  todaySeconds?: number; // Accumulated visibility seconds
  todayVisits?: number;  // Accumulated visitor counts
}
