import os from "os";
import { v4 as uuid } from "uuid";
import { Analytics } from "@segment/analytics-node";

const DEFAULT_WRITE_KEY = "AhYEnWamvR0lVj5JYLDsnxcySWdG6Q5J";
const WRITE_KEY = process.env.SEGMENT_WRITE_KEY ?? DEFAULT_WRITE_KEY;
const analyticsDisabled = process.env.SEGMENT_OPT_OUT === "1" || process.env.CI === "true";

const enabled = Boolean(WRITE_KEY) && !analyticsDisabled;

const analytics = enabled
  ? new Analytics({ writeKey: WRITE_KEY })
  : { track: () => { }, identify: () => { }, flush: () => Promise.resolve() } as unknown as Analytics;

const anonymousId = uuid();

export const identifyRun = () => {
  if (!enabled) return;
  analytics.identify({
    anonymousId,
    traits: {
      os_platform: process.platform,
      os_release: os.release(),
      node_version: process.version,
    },
  });
};

export const track = (event: string, properties: Record<string, unknown> = {}) =>
  analytics.track({
    event,
    anonymousId,
    properties,
  });

export const flush = () => analytics.flush();