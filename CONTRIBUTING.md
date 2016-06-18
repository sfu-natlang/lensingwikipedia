# Contributing to the Lensing Wikipedia project

The collaboration model for this project is a somewhat simplified version of
this: http://nvie.com/posts/a-successful-git-branching-model/ Since we don't
really have releases, we ignore the release branches.

So the workflow is the following (**bold** means mandatory naming style):

* **master** is the main (stable) branch that is only merged into when we want
  to release an update to the site
* **develop** is the branch where we have the current version of the site in
  development (should be fairly stable, but not ready for the main site)
    * Branches off master
    * Always exists
    * This is what's on the staging version of the site
    * This is automatically deployed.
* **hotfix-** are branches that implement a fix for an issue on the main site
    * Branch off master
    * Merge into master *and* develop (PR against master is mandatory, PR
      against develop is optional if you contact the maintainer of that branch
      separately).
* feature branches implement a certain feature. Name should reflect the feature
  being implemented
    * Branch off develop
    * Merge into develop (create a PR, or email the maintainer to pull your
      changes in from wherever your repo is)
    * Try to rebase before creating the PR (to avoid merge conflicts)
    * Try not to push to this github repo before it's done (so that you can
      safely rebase and clean up your commits).
        * you can use a another repo (GitHub, Bitbucket, self-hosted) for
          backup.
        * if you want to discuss a feature before it's done, then make sure
          your commit history is clean, push your branch, and then create the
          PR. Once the PR is created, don't push unnecessary commits to the
          branch; make sure your commit history is clean (i.e. squash your
          commits when it makes sense) before pushing. There shouldn't be any
          "Oops, forgot to remove this line" sort of commits.
    * it's usually a good idea to split large features into smaller ones to
      avoid having to rebase too many commits (and potentially have to fix a
      lot of conflicts)

For consistency’s sake (since GitHub will always create merge commits for PRs),
we use `git merge --no-ff`. This also helps if we want to revert the site
back to a previous version.

**Don't** merge develop/master into your branch before creating a PR. We don't
need two merge commits for one merge. If there are going to be merge conflicts,
rebase (which is why you don't want to push to this repo before your feature is
done), or the maintainer of the branch you're merging into can fix it on the
command line. Rebasing is always preferable (you get all the benefits of a
merge + cleaner commit history).

If you've already pushed, but you want to rebase, delete the remote branch,
rename your local branch, and then rebase. `git push --force` is only an option
when you've emailed everyone and made sure that people know you might break
things.

## Merging into master

### hotfixes

As described above, if you've created a hotfix branch, create a pull request
against **master**, and one against **develop**.

### develop

_Only the maintainer of the **develop** branch creates these pull requests._

To merge the develop branch into master, tag the last commit you want merged
using `vX.Ydev` where `X.Y` is the next version number after the one in master
(e.g. if the last tag in master is `v0.3`, you want your tag to be `v0.4dev`).

After pushing your tag (`git push --tags`), create a pull request, comparing
**develop** against **master**. Unfortunately, GitHub doesn't allow pull
requests based on tags (although it does allow you to compare using tags); if
it does at the time you're creating the PR, create the PR based on the tag
instead.

In the title of your PR, add your tag in square brackets: 'Some PR title
[vX.Ydev]'.

In the body of your PR, summarize the changes contained between the last merge
with master and now.

If the maintainer of the **master** branch is fine with merging based on tags
(using command-line git), then feel free to continue pushing things to develop
and working on it. Otherwise, do not push anything to **develop** until your
pull request has been merged; we don't want extra commits to be merged in
before they're ready.


## Commit messages

Please follow the following guidelines for writing commit messages:

* http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html
* https://github.com/alphagov/styleguides/blob/master/git.md

Most importantly, write simple, clear, and concise (max 50 chars) commit
summary lines in the present tense which explain _what_ your commit does. If
you find you need to write too much to explain what it does, consider splitting
it into multiple commits; it's going to be easier to locate bugs using `git
bisect` if you do that anyways.


## Maintainers

@anoopsarkar maintains **master** and @avacariu maintains **develop**.

## Git is distributed!

Remember, git is distributed; you don't have to push everything to the central
repo. You don't have to push all your commits as soon as you create them. They
can live on your machine, and you can perfect them before pushing.
