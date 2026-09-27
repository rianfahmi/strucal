export type HealthPayload = {
  service: "strucal";
  status: "ok";
  version: string;
};

export function createHealthPayload(): HealthPayload {
  return {
    service: "strucal",
    status: "ok",
    version: process.env.APP_VERSION ?? "0.0.0",
  };
}
