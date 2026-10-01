/** The build-time variables the client reads; see frontend/.env.example. */
interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
    /** Both set: the sign-in page offers "Try the demo". */
    readonly VITE_DEMO_EMAIL?: string;
    readonly VITE_DEMO_PASSWORD?: string;
}
