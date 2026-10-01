import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { isDeliverable, sendEmail, verificationEmail } from "./mail.js";

const message = {
    to: "dana@gmail.com",
    subject: "Please verify your email",
    content: verificationEmail("dana", "https://app.example/verify-email/abc"),
};

describe("sendEmail through Brevo", () => {
    let fetchMock;

    beforeEach(() => {
        process.env.BREVO_API_KEY = "test-key";
        process.env.MAIL_FROM = "hello@projectcamp.dev";
        fetchMock = mock.method(
            globalThis,
            "fetch",
            async () => new Response("{}", { status: 201 }),
        );
    });

    afterEach(() => {
        delete process.env.BREVO_API_KEY;
        delete process.env.MAIL_FROM;
        mock.restoreAll();
    });

    it("posts the rendered email to Brevo's HTTPS API", async () => {
        await sendEmail(message);

        assert.equal(fetchMock.mock.callCount(), 1);
        const [url, init] = fetchMock.mock.calls[0].arguments;
        assert.equal(url, "https://api.brevo.com/v3/smtp/email");
        assert.equal(init.headers["api-key"], "test-key");

        const body = JSON.parse(init.body);
        assert.deepEqual(body.sender, {
            name: "Project Camp",
            email: "hello@projectcamp.dev",
        });
        assert.deepEqual(body.to, [{ email: "dana@gmail.com" }]);
        assert.equal(body.subject, "Please verify your email");
        assert.match(body.htmlContent, /verify-email\/abc/);
        assert.match(body.textContent, /verify-email\/abc/);
    });

    it("logs a refusal instead of throwing it", async () => {
        fetchMock.mock.mockImplementation(
            async () => new Response("unauthorized", { status: 401 }),
        );
        const logged = mock.method(console, "error", () => {});

        await assert.doesNotReject(sendEmail(message));
        assert.equal(logged.mock.callCount(), 1);
        assert.match(logged.mock.calls[0].arguments[1], /401/);
    });

    it("never sends to a reserved address", async () => {
        await sendEmail({ ...message, to: "demo.owner@example.com" });
        await sendEmail({ ...message, to: "verify-admin-1@test.local" });

        assert.equal(fetchMock.mock.callCount(), 0);
    });
});

describe("isDeliverable", () => {
    it("refuses documentation and test domains", () => {
        for (const address of [
            "a@example.com",
            "a@mail.example.org",
            "a@site.test",
            "a@test.local",
            "a@x.invalid",
            "a@localhost",
        ]) {
            assert.equal(isDeliverable(address), false, address);
        }
    });

    it("accepts real domains, including look-alikes", () => {
        for (const address of [
            "dana@gmail.com",
            "a@notexample.com",
            "a@example.co",
        ]) {
            assert.equal(isDeliverable(address), true, address);
        }
    });
});
