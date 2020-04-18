# MOU Deploy Action

Creates a Github deployment, and tells `mou-rest` to deploy, and updates its progress.

[![main](https://github.com/minddocdev/mou-deploy-action/workflows/main/badge.svg)](https://github.com/minddocdev/mou-deploy-action/actions?workflow=main)

## Usage

Use the action to create a release.

For given tags (automatic tag creation would be disabled):

```yaml
name: 'myrelease'
on:
  push:
    branches:
      - master
jobs:
  bump:
    runs-on: ubuntu-latest
    env:
      APP: myapp
    steps:
      - name: Checkout git repository
        uses: actions/checkout@master
      - name: Bump version and push tag
        uses: minddocdev/mou-version-action@master
        id: bump_version
        with:
          prefix: ${{ env.APP }}@
          token: ${{ github.token }}
      - name: Create Release
        uses: minddocdev/mou-deploy-action@master
        with:
          app: ${{ env.APP }}
          baseTag: my-production-deployed-tag
          releaseName: ${{ env.APP }} ${{ steps.bump_version.outputs.version }}
          releaseTag: ${{ steps.bump_version.outputs.tag }}
          templatePath: RELEASE_DRAFT/default.md
          token: ${{ github.token }}
```

In the following example, the action will check for the latest published release that matches
`myapp@` prefix, create a changelog for all the commits that has the `(myapp)` scope,
and bump the version to `minor`, `major` or `patch` depending on the commit messages and if there
was a previous `minor` or `major` bump in the diff with the latest published tag.

```yaml
name: 'myrelease'
on:
  push:
    branches:
      - master
jobs:
  bump:
    runs-on: ubuntu-latest
    env:
      APP: myapp
    steps:
      - name: Checkout git repository
        uses: actions/checkout@master
      - name: Create Release
        uses: minddocdev/mou-release-action@master
        with:
          app: ${{ env.APP }}
          templatePath: RELEASE_DRAFT/default.md
          token: ${{ github.token }}
```

## Options

### Inputs

#### `app`

- name: app
- required: false
- description: The name of the app involved in the release.
Creates tag and render commits for a specific scope, based on the given app name.
Scopes from commits are analyzed for commits that follow the Angular commit style.
e.g. `<type>(<app>): my commit title` or `(<app>): my commit title`

#### `baseTag`

- name: baseTag
- required: false
- description: The tag that will be used as base for git commit comparison,
instead of the automatic detection of latest published release.
The commits will be formatted into a Markdown list and replaced into the `$CHANGES`
variable for the given `templatePath` template file.

#### `bumpProtection`

- name: bumpProtection
- required: false
- default: `false`
- description: Propose PATCH version bumps whenever a MINOR or MAJOR is detected
in a diff that had a previous MINOR or MAJOR bump.
See [multiple minor and major bump protection](#multiple-minor-and-major-bump-protection).

#### `draft`

- name: draft
- required: false
- default: `true`
- description: Publish release draft.

#### `prerelease`

- name: prerelease
- required: false
- default: `true`
- description: Mark release as prerelease when creating.

#### `pushTag`

- name: pushTag
- required: false
- default: `false`
- description: Creates and pushes the automatic calculated tag before creating the release.
Useful if you want the action to handle tags for you when publishing drafts.
By default, a release draft won't create the tag, which only happens when it is published.

#### `releaseName`

- name: releaseName
- required: false
- default: `<app> <version>`
- description: The title of the release.

#### `releaseTag`

- name: releaseTag
- required: true
- description: The git tag that belongs to the release.

#### `taskBaseUrl`

- name: taskBaseUrl
- required: false
- description: The base url to append for a detected task (do not set a trailing `/`).
By default, it will create a url based on your Github organization.
(e.g. `https://myorg.atlassian.net/browse`)

#### `taskPrefix`

- name: taskPrefix
- required: false
- default: `JIRA-`
- description: The prefix that identifies task ids in the commits

#### `templatePath`

- name: templatePath
- required: true
- description: The path for the Markdown template that will be used to create the release body,
relative to `.github/`.

#### `token`

- name: token
- required: true
- description: The token to access Github's API.

### Outputs

#### `changes`

- name: changes
- description: A JSON array with the list of commit sha that are involved in the release.

#### `new_tag`

- name: new_tag
- description: The newly created tag that will reference the release.

#### `new_version`

- name: new_version
- description: The newly created version that belongs to the tag.

#### `html_url`

- name: html_url
- description: The browser url linking to Github's release.

#### `tasks`

- name: tasks
- description: A JSON array with the list of project management tasks involved in the release.

#### `previous_tag`

- name: previous_tag
- description: The previously detected tag that was bumped by the action.

#### `previous_version`

- name: previous_version
- description: The previously detected version that was bumped by the action.

#### `pull_requests`

- name: pull_requests
- description: A JSON array with the list of Github pull requests involved in the release.

#### `release_id`

- name: release_id
- description: The release id given by Github's API.

#### `upload_url`

- name: upload_url
- description: The url used for uploading release artifacts.

## Development

Install dependencies

```bash
yarn npm login --scope minddocdev
yarn
```

Compile typescript

```bash
yarn build
```

Lint code

```bash
yarn lint
```

Run the tests

```bash
yarn test
```
