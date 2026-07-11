import { createContext, useContext } from "react";

// Lets routed pages (e.g. AlertsPage) reopen the Inbox modal that Layout owns.
// Layout provides the real open/close; default is a no-op so consumers never crash.
export const InboxContext = createContext({
    openInbox:  () => {},
    closeInbox: () => {},
});

export const useInbox = () => useContext(InboxContext);