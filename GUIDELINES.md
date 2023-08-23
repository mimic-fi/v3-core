# Engineering Guidelines

## Testing

Code must be thoroughly tested with quality unit tests.

We defer to the [Moloch Testing Guide](https://github.com/MolochVentures/moloch/tree/master/test#readme) for specific recommendations, though not all of it is relevant here. Note the introduction:

> Tests should be written, not only to verify correctness of the target code, but to be comprehensively reviewed by other programmers. Therefore, for mission critical Solidity code, the quality of the tests are just as important (if not more so) than the code itself, and should be written with the highest standards of clarity and elegance.

Every addition or change to the code must come with relevant and comprehensive tests.

Refactors should avoid simultaneous changes to tests.

Flaky tests are not acceptable.

The test suite should run automatically for every change in the repository, and in pull requests tests must pass before merging.

The test suite coverage must be kept as close to 100% as possible, enforced in pull requests.

In some cases unit tests may be insufficient and complementary techniques should be used:

1. Property-based tests (aka. fuzzing) for math-heavy code.
2. Formal verification for state machines.

## Code style

Solidity code should be written in a consistent format enforced by a linter, following the official [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html).

The code should be simple and straightforward, prioritizing readability and understandability. Consistency and predictability should be maintained across the codebase. In particular, this applies to naming, which should be systematic, clear, and concise.

Sometimes these guidelines may be broken if doing so brings significant efficiency gains, but explanatory comments should be added.

Modularity should be pursued, but not at the cost of the above priorities.

## Documentation

For contributors, project guidelines and processes must be documented publicly.

For users, features must be abundantly documented. Documentation should include answers to common questions, solutions to common problems, and recommendations for critical decisions that the user may face.

## Peer review

All changes must be submitted through pull requests and go through peer code review.

The review must be approached by the reviewer in a similar way as if it was an audit of the code in question (but importantly it is not a substitute for and should not be considered an audit).

Reviewers should enforce code and project guidelines.

External contributions must be reviewed separately by multiple maintainers.

## Pull requests

Pull requests are squash-merged to keep the `master` branch history clean. The title of the pull request becomes the commit message, so it should be written in a consistent format:

1) Begin with a capital letter.
2) Do not end with a period.
3) Write in the imperative: "Add feature X" and not "Adds feature X" or "Added feature X".

This repository does not follow conventional commits, so do not prefix the title with "fix:" or "feat:".

Work in progress pull requests should be submitted as Drafts and should not be prefixed with "WIP:".

Branch names don't matter, and commit messages within a pull request mostly don't matter either, although they can help the review process.
