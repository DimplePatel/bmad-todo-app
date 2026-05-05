export class HttpError extends Error {
  public readonly status: number;
  public readonly issues?: unknown;

  constructor(status: number, message: string, issues?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.issues = issues;
  }
}
