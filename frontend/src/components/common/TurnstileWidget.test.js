import React, { StrictMode, act } from "react";
import { createRoot } from "react-dom/client";
import { TurnstileWidget } from "./TurnstileWidget";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../lib/supabase", () => ({
  BACKEND_ENABLED: true,
  TURNSTILE_SITE_KEY: "test-site-key",
}));

const SCRIPT_SELECTOR = 'script[data-cvf-turnstile="true"]';

function createTurnstileApi() {
  return {
    render: jest.fn(() => "widget-1"),
    remove: jest.fn(),
    reset: jest.fn(),
  };
}

describe("TurnstileWidget", () => {
  let container;
  let root;

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    delete window.turnstile;
    document.querySelectorAll(SCRIPT_SELECTOR).forEach((script) => script.remove());
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.querySelectorAll(SCRIPT_SELECTOR).forEach((script) => script.remove());
    delete window.turnstile;
    jest.useRealTimers();
  });

  async function render(ui) {
    await act(async () => root.render(ui));
  }

  async function dispatch(script, eventName) {
    await act(async () => {
      script.dispatchEvent(new Event(eventName));
      await Promise.resolve();
    });
  }

  test("deduplicates concurrent script loading", async () => {
    const api = createTurnstileApi();

    await render(
      <>
        <TurnstileWidget action="admin_login" onToken={jest.fn()} />
        <TurnstileWidget action="admin_recovery" onToken={jest.fn()} />
      </>,
    );

    const scripts = document.querySelectorAll(SCRIPT_SELECTOR);
    expect(scripts).toHaveLength(1);
    window.turnstile = api;
    await dispatch(scripts[0], "load");
    expect(api.render).toHaveBeenCalledTimes(2);
  });

  test("uses the current callbacks after a rerender", async () => {
    const api = createTurnstileApi();
    const firstToken = jest.fn();
    const nextToken = jest.fn();
    const firstError = jest.fn();
    const nextError = jest.fn();
    window.turnstile = api;

    await render(<TurnstileWidget action="admin_login" onToken={firstToken} onError={firstError} />);
    const options = api.render.mock.calls[0][1];
    await render(<TurnstileWidget action="admin_login" onToken={nextToken} onError={nextError} />);

    act(() => options.callback("fresh-token"));
    act(() => options["error-callback"]());
    expect(firstToken).not.toHaveBeenCalled();
    expect(firstError).not.toHaveBeenCalled();
    expect(nextToken).toHaveBeenNthCalledWith(1, "fresh-token");
    expect(nextToken).toHaveBeenNthCalledWith(2, "");
    expect(nextError).toHaveBeenCalledWith("Human verification failed to load.");
  });

  test("removes a failed script and succeeds on retry", async () => {
    const onError = jest.fn();
    await render(<TurnstileWidget action="admin_login" onToken={jest.fn()} onError={onError} />);
    const failedScript = document.querySelector(SCRIPT_SELECTOR);

    await dispatch(failedScript, "error");
    expect(onError).toHaveBeenCalledWith("Human verification could not load.");
    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();

    await render(null);
    await render(<TurnstileWidget action="admin_login" onToken={jest.fn()} onError={onError} />);
    const retryScript = document.querySelector(SCRIPT_SELECTOR);
    expect(retryScript).not.toBe(failedScript);

    const api = createTurnstileApi();
    window.turnstile = api;
    await dispatch(retryScript, "load");
    expect(api.render).toHaveBeenCalledTimes(1);
  });

  test("fails cleanly when the script loads without an API", async () => {
    const onError = jest.fn();
    await render(<TurnstileWidget action="admin_login" onToken={jest.fn()} onError={onError} />);

    await dispatch(document.querySelector(SCRIPT_SELECTOR), "load");
    expect(onError).toHaveBeenCalledWith("Human verification could not initialize.");
    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();
  });

  test("times out, cleans up, and leaves a retryable loader", async () => {
    jest.useFakeTimers();
    const onError = jest.fn();
    await render(<TurnstileWidget action="admin_login" onToken={jest.fn()} onError={onError} />);

    await act(async () => {
      jest.advanceTimersByTime(10000);
      await Promise.resolve();
    });
    expect(onError).toHaveBeenCalledWith("Human verification timed out.");
    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();
  });

  test.each(["load", "error"])("does not update or render after unmount before %s", async (eventName) => {
    const onToken = jest.fn();
    const onError = jest.fn();
    await render(<TurnstileWidget action="admin_login" onToken={onToken} onError={onError} />);
    const script = document.querySelector(SCRIPT_SELECTOR);
    await render(null);

    if (eventName === "load") window.turnstile = createTurnstileApi();
    await dispatch(script, eventName);

    expect(onToken).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    if (window.turnstile) expect(window.turnstile.render).not.toHaveBeenCalled();
  });

  test("resets the rendered widget when the reset signal changes", async () => {
    const api = createTurnstileApi();
    const onToken = jest.fn();
    window.turnstile = api;
    await render(<TurnstileWidget action="admin_login" onToken={onToken} resetSignal={0} />);

    await render(<TurnstileWidget action="admin_login" onToken={onToken} resetSignal={1} />);
    expect(api.reset).toHaveBeenCalledWith("widget-1");
    expect(onToken).toHaveBeenCalledWith("");
  });

  test("reports a safe error when rendering or resetting throws", async () => {
    const renderError = jest.fn();
    const renderToken = jest.fn();
    const brokenRenderApi = createTurnstileApi();
    brokenRenderApi.render.mockImplementation(() => { throw new Error("third-party detail"); });
    window.turnstile = brokenRenderApi;
    await render(<TurnstileWidget action="admin_login" onToken={renderToken} onError={renderError} />);
    expect(renderToken).toHaveBeenCalledWith("");
    expect(renderError).toHaveBeenCalledWith("Human verification could not initialize.");

    await render(null);
    const resetError = jest.fn();
    const resetToken = jest.fn();
    const brokenResetApi = createTurnstileApi();
    brokenResetApi.reset.mockImplementation(() => { throw new Error("third-party detail"); });
    window.turnstile = brokenResetApi;
    await render(<TurnstileWidget action="admin_login" onToken={resetToken} onError={resetError} resetSignal={0} />);
    await render(<TurnstileWidget action="admin_login" onToken={resetToken} onError={resetError} resetSignal={1} />);
    expect(resetToken).toHaveBeenCalledWith("");
    expect(resetError).toHaveBeenCalledWith("Human verification could not reset. Please reload and try again.");
  });

  test("reports expiry, interactive timeout, and widget errors", async () => {
    const api = createTurnstileApi();
    const onToken = jest.fn();
    const onError = jest.fn();
    window.turnstile = api;
    await render(<TurnstileWidget action="team_registration" onToken={onToken} onError={onError} />);
    const options = api.render.mock.calls[0][1];

    act(() => options["expired-callback"]());
    expect(onError).toHaveBeenLastCalledWith("Human verification expired. Please complete it again.");
    expect(api.reset).toHaveBeenLastCalledWith("widget-1");

    act(() => options["timeout-callback"]());
    expect(onError).toHaveBeenLastCalledWith("Human verification timed out. Please complete it again.");
    expect(api.reset).toHaveBeenCalledTimes(2);

    let handled;
    act(() => { handled = options["error-callback"](); });
    expect(handled).toBe(true);
    expect(onError).toHaveBeenLastCalledWith("Human verification failed to load.");
    expect(onToken).toHaveBeenCalledTimes(3);
    expect(onToken).toHaveBeenLastCalledWith("");
  });

  test("renders and removes one widget under Strict Mode", async () => {
    const api = createTurnstileApi();
    window.turnstile = api;
    await render(
      <StrictMode>
        <TurnstileWidget action="admin_login" onToken={jest.fn()} />
      </StrictMode>,
    );

    expect(api.render).toHaveBeenCalledTimes(1);
    delete window.turnstile;
    await render(null);
    expect(api.remove).toHaveBeenCalledTimes(1);
    expect(api.remove).toHaveBeenCalledWith("widget-1");
  });

  test("ignores widget callbacks queued after unmount", async () => {
    const api = createTurnstileApi();
    const onToken = jest.fn();
    const onError = jest.fn();
    window.turnstile = api;
    await render(<TurnstileWidget action="admin_login" onToken={onToken} onError={onError} />);
    const options = api.render.mock.calls[0][1];
    await render(null);

    act(() => {
      options.callback("late-token");
      options["expired-callback"]();
      options["timeout-callback"]();
      options["error-callback"]();
    });
    expect(onToken).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
