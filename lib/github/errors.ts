// Typed GitHub errors. §9: private and missing repos are indistinguishable.
export class RepoNotFoundError extends Error {
  constructor(slug: string) {
    super(`No grave by that name: ${slug}`);
    this.name = 'RepoNotFoundError';
  }
}

export class GitHubRateLimitError extends Error {
  constructor(public readonly resetAt: Date | null) {
    super('The archive is sealed for now.');
    this.name = 'GitHubRateLimitError';
  }
}

// A GitHub call that failed for a reason that is neither "missing" nor
// "rate-limited" (e.g. a 5xx that survived every retry, or a persistent
// network fault). Callers that want the §9 "No grave by that name." collapse
// use `getJson`, which maps 404/403 to RepoNotFoundError; anything else that
// cannot be recovered surfaces as this typed error instead of a bare Error.
export class GitHubError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}
