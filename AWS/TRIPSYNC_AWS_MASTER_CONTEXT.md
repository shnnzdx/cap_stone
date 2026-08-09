# TripSync Capstone — AWS Access, Security, GitHub Actions, Cost Guardrails & Deployment Master Context

**Document status:** Master handoff / source of truth for the current AWS setup and the next deployment phases  
**Primary AWS Region:** `us-east-1`  
**AWS Account ID:** `448678332746`  
**Project:** TripSync Capstone  
**Last updated:** 2026-08-09

---

# 1. Purpose of This Document

This document records the complete working context for the TripSync Capstone AWS environment so that any teammate, Codex session, or future deployment task understands:

1. who currently has AWS access;
2. what “equal long-term access” means for the three human project members;
3. how the GitHub Actions AWS identity is separated from human accounts;
4. what has already been validated;
5. what must not be changed accidentally;
6. the current application architecture;
7. the approved low-risk AWS deployment architecture;
8. cost and AWS Free Plan constraints;
9. the required deployment sequence;
10. the security rules for passwords, access keys, GitHub secrets, and application secrets.

This is intentionally more complete than a deployment checklist. It is meant to be reusable as background context when asking Codex to work on the repository.

---

# 2. Executive Summary

The TripSync team currently uses one standalone AWS account.

The desired long-term human access model is:

```text
Three human project members
        |
        v
same long-term AWS project administration capability
        |
        v
Capstone-Admins
        |
        v
AdministratorAccess
```

However, an important AWS distinction applies:

- An AWS **root user can never be made literally equivalent to an IAM administrator**.
- Root always remains the account-owner identity and has some root-only capabilities.
- Therefore, if one of the three humans continues to use Root while the other two use IAM users, the three people are **project-resource equivalent for normal administration**, but they are **not identity-level identical**.
- If the team wants literal day-to-day equality, the clean model is three human IAM users in the same `Capstone-Admins` group, while Root is retained only as the account-owner/emergency identity.

For this project, there is also a separate machine identity:

```text
github-actions-deploy
```

This account is **not one of the three human accounts**. It exists only so GitHub Actions can authenticate programmatically to AWS.

The GitHub Actions authentication path is already configured using long-term IAM access keys:

```text
GitHub Actions
  -> GitHub Environment: Main
  -> AWS_ACCESS_KEY_ID
  -> AWS_SECRET_ACCESS_KEY
  -> AWS_REGION=us-east-1
  -> AWS IAM user: github-actions-deploy
  -> AWS STS
```

The identity path has been validated with:

```bash
aws sts get-caller-identity
```

The expected AWS account identity is:

```text
Account: 448678332746
Arn: arn:aws:iam::448678332746:user/github-actions-deploy
```

The AWS identity-check workflow must stay separate from future build/deployment workflows.

---

# 3. AWS Account Plan and Critical Free Plan Constraint

This is a new AWS Free Plan account.

Current AWS Free Plan rules for new customers:

- `$100` AWS credits are granted at sign-up.
- Up to another `$100` can be earned through eligible AWS activities.
- The Free Plan lasts for up to **6 months**, or until available Free Tier credits are exhausted, whichever happens first.
- The Free Plan has access to a limited set of AWS services/features.
- The account should not be upgraded unintentionally.

## 3.1 DO NOT create or join AWS Organizations

This is a hard project constraint.

For a Free Plan account, creating or joining AWS Organizations automatically upgrades the account to a Paid Plan and causes remaining Free Tier credits to expire immediately.

Therefore, during this Capstone phase:

```text
DO NOT:
- Create AWS Organizations
- Join AWS Organizations
- Enable an IAM Identity Center organization instance
- Set up AWS Control Tower
```

This is why the project currently uses standalone IAM users rather than an AWS Organizations + IAM Identity Center workforce architecture.

---

# 4. Current Human AWS Access

## 4.1 Current known structure

```text
AWS Account 448678332746
|
|-- Root user
|    `-- retained by project account owner
|
`-- IAM
     |
     `-- Group: Capstone-Admins
          |
          |-- Carina
          `-- Dixon
```

The intended policy attached to `Capstone-Admins` is:

```text
AWS managed policy:
AdministratorAccess
```

`AdministratorAccess` grants full access to AWS services and resources and allows delegation of permissions.

## 4.2 What the two IAM administrators should be able to manage

With `AdministratorAccess`, the two IAM administrators are intended to have the same project-level AWS administration capability for services such as:

```text
IAM
EC2
ECS
Fargate
ECR
Elastic Load Balancing
RDS
S3
CloudWatch
Lambda
API Gateway
Systems Manager
SSM Parameter Store
Amplify-related AWS configuration where available
Security Groups
VPC resources
CloudFormation
Budgets/Cost APIs where billing access is enabled
```

This means that for ordinary TripSync infrastructure work, both IAM users should be treated as peer administrators.

---

# 5. The “Three Humans Have the Same Long-Term Access” Requirement

This section is the most important identity-design clarification.

## 5.1 Current model: Root + 2 IAM administrators

If the three humans are:

```text
Human 1 -> Root
Human 2 -> IAM user Carina -> Capstone-Admins
Human 3 -> IAM user Dixon  -> Capstone-Admins
```

then they are **not literally identical identities**.

Why:

```text
Root
  -> complete account-owner authority
  -> root-only account operations
  -> cannot be restricted by normal IAM identity policies

AdministratorAccess IAM user
  -> effectively full AWS service/resource administration
  -> cannot perform some root-only account operations
```

Therefore the correct description of the current model is:

> The three project members have effectively equal permissions for normal project infrastructure administration, while the Root user retains unavoidable account-owner/root-only privileges.

Do not describe Root and IAM administrators as cryptographically or identity-level identical.

## 5.2 Recommended model if literal day-to-day equality is required

If the requirement is:

> “All three humans must use the same type of long-term account and inherit exactly the same IAM policy.”

then use:

```text
Root
  -> emergency/account-owner only
  -> not counted as one of the three daily project accounts

Capstone-Admins
  -> AdministratorAccess
  |
  |-- Human IAM user 1
  |-- Human IAM user 2
  `-- Human IAM user 3
```

The third IAM user can use a neutral name if `Dixon` is already occupied, for example:

```text
ProjectOwnerAdmin
```

All three human IAM users would then have:

```text
same IAM group
same AdministratorAccess policy
same project-resource authorization model
independent username
independent password
independent MFA
```

This is the cleanest way to satisfy literal long-term day-to-day equality while keeping the Root identity separate.

## 5.3 What “long-term” means here

AWS distinguishes long-term and temporary credentials.

For human IAM users, long-term credentials can include:

```text
IAM username
IAM console password
optional IAM access key pair
```

Passwords/access keys remain valid until they are changed, disabled, or deleted.

For this project:

- The **console password** is enough for human AWS Console access.
- Do **not** create programmatic access keys for every human merely to make them “equal.”
- If a teammate genuinely needs AWS CLI/SDK access, create a unique access key for that individual IAM user.
- Never share one human access key between multiple people.

Equality should come from the shared IAM group/policy, **not from sharing credentials**.

---

# 6. Root User Policy

The Root user remains the AWS account-owner identity.

## 6.1 Root must remain separate

Root should not be shared with teammates.

Never share:

```text
root email
root password
root MFA device / recovery codes
root access key
```

## 6.2 Root MFA

Root must have MFA enabled.

## 6.3 Root access keys

Do not create Root access keys.

GitHub Actions, local CLI use, and application workloads must not use Root programmatic credentials.

## 6.4 Root use under the current project choice

The project owner may continue to use Root knowingly, but the operational model must still acknowledge that Root is more privileged than the two IAM administrators.

If strict three-way equality later becomes more important than convenience, create a third IAM administrator and reserve Root for account-owner/emergency work.

---

# 7. Billing and Cost Console Equality

There is one AWS-specific exception that commonly causes confusion.

Even an IAM principal with `AdministratorAccess` cannot necessarily access the Billing and Cost Management console by default.

The Root user must first activate:

```text
IAM User and Role Access to Billing Information
```

Console path:

```text
Root login
-> Account
-> IAM User and Role Access to Billing Information
-> Edit
-> Activate IAM Access
```

After this account-level switch is enabled, IAM policies can control Billing access.

If the goal is for the two IAM administrators to monitor cost and budgets similarly to Root, this account-level billing access should be activated and the appropriate Billing permissions confirmed.

This does not make IAM users Root-equivalent; it only delegates Billing console access.

---

# 8. Human Credential Rules

Each human must have independent credentials.

Required:

```text
unique IAM username
unique password
unique MFA
```

Forbidden:

```text
shared IAM password
shared MFA seed
shared access key
root credentials shared in Discord/Teams/email
credentials committed into git
credentials pasted into source code
credentials stored in .env committed to GitHub
```

The `Capstone-Admins` group is the permissions source. Individual users should not receive random extra administrator policies unless there is a documented reason.

---

# 9. GitHub Actions AWS Machine Identity

GitHub Actions uses a separate IAM user:

```text
github-actions-deploy
```

This is a machine/service identity, not a human team member.

## 9.1 Programmatic long-term credentials

The current design intentionally uses:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

These are long-term IAM credentials.

The team has consciously chosen this method for now instead of OIDC.

AWS generally recommends temporary credentials where possible, but this project is intentionally retaining access-key authentication during the Capstone deployment phase.

## 9.2 Secret location

The AWS keys must exist only in protected secret storage.

Current GitHub configuration:

```text
GitHub Environment:
Main
```

Secrets:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

Variable:

```text
AWS_REGION=us-east-1
```

Never store actual values in:

```text
README.md
docs/
source code
Dockerfile
docker-compose files
committed .env files
workflow YAML plaintext
frontend code
backend code
```

## 9.3 IAM user identity validation

The AWS machine identity has been validated with:

```bash
aws sts get-caller-identity
```

Known target identity:

```json
{
  "Account": "448678332746",
  "Arn": "arn:aws:iam::448678332746:user/github-actions-deploy"
}
```

The STS check proves which AWS principal GitHub is authenticating as.

It does **not**, by itself, prove what IAM policies are attached to that user.

Before deployment begins, explicitly inspect the attached policies for `github-actions-deploy`.

---

# 10. Important Permission Separation: Humans vs GitHub

Do not combine the two concepts.

Human administration:

```text
Capstone-Admins
  -> humans
  -> AWS Console
  -> AdministratorAccess
```

Automation:

```text
github-actions-deploy
  -> GitHub Actions
  -> access key
  -> deployment automation
```

The automation IAM user does not need a Console password.

Long term, the deployment user should receive only the permissions needed for the actual deployment path. During initial bring-up it may temporarily use broader permissions, but the final target should be reduced.

Do not put `github-actions-deploy` into the human administrator group simply to make configuration easier unless that choice is explicitly documented.

---

# 11. GitHub Actions Current State

The AWS identity workflow must remain a validation-only workflow.

Current workflow path:

```text
.github/workflows/main.yml
```

Displayed workflow name:

```text
AWS Identity Check
```

Current design:

```text
trigger:
workflow_dispatch only
```

Current job uses GitHub Environment:

```text
Main
```

Current AWS credential action:

```text
aws-actions/configure-aws-credentials@v6
```

It reads:

```text
${{ secrets.AWS_ACCESS_KEY_ID }}
${{ secrets.AWS_SECRET_ACCESS_KEY }}
${{ vars.AWS_REGION }}
```

It validates:

```bash
aws sts get-caller-identity
```

It does not deploy AWS resources.

## 11.1 Do not turn this file into the deployment workflow

Keep identity validation separate.

Future workflows should be separate files, for example:

```text
.github/workflows/main.yml
  -> AWS Identity Check

.github/workflows/build-validation.yml
  -> local/CI build validation only

.github/workflows/deploy-backend.yml
  -> future ECS deployment

frontend hosting workflow/config
  -> future Amplify deployment
```

---

# 12. Current Repository Architecture

The TripSync repository is a monorepo.

```text
/
|-- frontend/
|-- trip/
|-- backend/
|-- shared/
|-- docs/
|-- .github/workflows/
`-- ...
```

## 12.1 frontend/

`frontend/` is the main TripSync public-facing site/product shell.

It currently uses Vinext/Next-style application routing.

Important build behavior:

```text
npm run build
-> node scripts/run-vinext.mjs build
-> Vinext CLI
```

The frontend should **not** be assumed to be a standard vanilla Next.js build.

## 12.2 trip/

`trip/` is a standalone React + Vite Trip workspace.

Build command:

```bash
npm run build
```

It produces static output.

## 12.3 Current frontend/trip integration

The intended existing integration is:

```text
trip/
  -> Vite build
  -> trip/dist
  -> sync
  -> frontend/public/trip-app/
  -> embedded by the main frontend
```

The Trip workspace should not become a separate Amplify application unless the architecture is intentionally redesigned.

## 12.4 backend/

`backend/` is:

```text
Python
FastAPI
SQLAlchemy
PostgreSQL
```

The existing backend already exposes:

```text
GET /api/health
```

Expected result:

```json
{"ok": true}
```

Do not add another duplicate `/health` endpoint.

---

# 13. Existing Backend Cloud-Readiness Findings

## 13.1 Health check

Use this future ALB health check:

```text
/api/health
```

not:

```text
/health
```

## 13.2 CORS

Current CORS is development-oriented and allows localhost origins.

Before production deployment, move allowed origins into an environment variable, for example:

```text
CORS_ORIGINS
```

Local defaults can remain:

```text
http://localhost:3000
http://localhost:5173
```

Future production origin will include the actual Amplify domain.

## 13.3 Existing runtime environment variables

The deployment documentation should track at least:

```text
DATABASE_URL
TEST_DATABASE_URL
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
MOCK_AI
SETTLE_TICK_SECONDS
DISABLE_SCHEDULER
FRONTEND_BASE_URL
CORS_ORIGINS
```

No real secret values belong in git.

---

# 14. Database Safety Rule

The current development seed/reset flow is destructive.

Current code includes development behavior equivalent to:

```python
Base.metadata.drop_all(engine)
Base.metadata.create_all(engine)
```

Therefore:

```text
NEVER run destructive seed/reset automatically against RDS.
```

The production database must not depend on:

```text
python -m app.db.seed
```

as an automatic deployment step.

A safe migration strategy such as Alembic must be introduced before production-style RDS schema evolution.

The eventual split should be:

```text
schema migration
-> safe / versioned / repeatable

demo seed
-> optional / manual / non-production
```

---

# 15. Scheduler / ECS Constraint

The FastAPI application starts a scheduler unless:

```text
DISABLE_SCHEDULER=1
```

This matters when ECS scales to more than one task.

If multiple API containers start with the scheduler enabled:

```text
Task 1 -> scheduler
Task 2 -> scheduler
Task 3 -> scheduler
```

the same scheduling behavior can execute multiple times.

Initial Capstone production model:

```text
ECS desiredCount = 1
```

Do not enable ECS autoscaling initially.

For CI and container validation:

```text
DISABLE_SCHEDULER=1
```

A future scale-out architecture should separate API tasks and scheduled work.

---

# 16. Approved Low-Risk AWS Target Architecture

The target architecture is:

```text
GitHub
  |
  |-- identity/build/deploy workflows
  |
  v

AWS us-east-1

Frontend:
Amplify Hosting
  -> main frontend
  -> embedded trip static output

Backend:
Internet
  -> Application Load Balancer
  -> ECS Fargate
  -> FastAPI

Database:
ECS
  -> RDS PostgreSQL

Logging:
ECS
  -> CloudWatch Logs

Runtime secrets:
ECS Task
  -> SSM Parameter Store SecureString
```

This is intentionally a student/demo architecture rather than a highly redundant production platform.

---

# 17. Cost Guardrails

The project is intentionally cost-controlled.

Initial constraints:

```text
Region: us-east-1

ECS:
- desiredCount = 1
- no autoscaling initially
- smallest practical CPU/memory

RDS:
- PostgreSQL
- Single-AZ
- smallest appropriate Free Plan/credit-compatible instance
- minimum practical storage
- no Multi-AZ
- no Provisioned IOPS
- publicly accessible = No

Networking:
- NO NAT Gateway initially unless explicitly approved
- avoid unnecessary Elastic/Public IPv4 resources
- no complex multi-AZ enterprise topology for the first demo

Security/edge:
- no WAF initially
- no unnecessary paid observability products

Deployment:
- workflow_dispatch/manual gate first
```

A NAT Gateway must never be silently created by Codex or infrastructure automation.

---

# 18. Budget and Cost Monitoring

Before significant AWS provisioning:

1. Review the AWS Free Plan credit balance.
2. Record the Free Plan expiration date.
3. Create or confirm cost monitoring/budget alerts if available for the account configuration.
4. Monitor:
   - credits remaining;
   - current month estimated usage;
   - RDS;
   - ALB;
   - Fargate;
   - public IPv4;
   - CloudWatch usage.

The Free Plan does not mean resources have no underlying price. Credits/free-plan protections are a billing layer over service usage.

---

# 19. Runtime Application Secrets

Future application runtime secrets should not reuse GitHub AWS credentials.

Examples:

```text
DATABASE_URL
OPENAI_API_KEY
```

Recommended future storage:

```text
AWS Systems Manager Parameter Store
SecureString
```

Then:

```text
ECS Task Role
-> retrieve runtime parameters
```

Do not bake runtime secrets into Docker images.

Do not pass `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` into the application container unless the application has a specific documented reason to call AWS.

---

# 20. Deployment Phase Plan

## Phase 0 — Identity and Account Guardrails

Status: mostly complete.

```text
AWS account created
Free Plan recognized
AWS Organizations avoided
Capstone-Admins created
human IAM users added
GitHub deployment IAM user created
GitHub AWS secrets/region configured
STS identity validation completed
```

Remaining identity checks:

```text
- confirm AdministratorAccess is attached to Capstone-Admins
- confirm both human IAM users are members
- confirm MFA for human accounts
- confirm Root MFA
- decide whether strict three-IAM-user equality is required
- verify github-actions-deploy attached policies
- activate delegated Billing access if team needs it
```

## Phase 1 — Cloud Readiness

No AWS infrastructure creation.

Backend:

```text
keep /api/health
environment-driven CORS
complete .env.example
Dockerfile
.dockerignore
Docker local health validation
```

Database:

```text
document destructive seed behavior
plan safe migration strategy
do not run production seed
```

Frontend:

```text
validate Vinext hosting requirements
validate trip build/sync
validate frontend build
```

## Phase 2 — Build Validation CI

Create:

```text
.github/workflows/build-validation.yml
```

Trigger:

```text
workflow_dispatch only
```

It should:

```text
checkout
build trip
sync trip output
build frontend
run backend tests
docker build backend
run backend container
curl /api/health
```

It must not:

```text
configure AWS credentials
push ECR
deploy ECS
create RDS
create Amplify
change IAM
mutate AWS
```

## Phase 3 — Frontend Hosting Proof

Only after Phase 2 is green.

Investigate/validate:

```text
Vinext
-> Amplify-compatible build path
-> Nitro if required
```

Use the main frontend application as the hosting unit.

The Trip static build remains embedded.

## Phase 4 — Database

Create minimal RDS PostgreSQL only after the schema migration approach is safe.

Required:

```text
Single-AZ
private
smallest practical instance
safe schema creation/migration
no destructive automatic seed
```

## Phase 5 — Backend

Resources:

```text
ECR
ECS cluster
Fargate task definition
ECS service
ALB
CloudWatch log group
```

Initial:

```text
desiredCount=1
health path=/api/health
```

## Phase 6 — Runtime Secrets

Move runtime application secrets to SSM Parameter Store SecureString.

## Phase 7 — Frontend/Backend Integration

Set frontend API base URL to the deployed backend endpoint.

Set backend CORS production origin to the real frontend domain.

## Phase 8 — Deployment Automation

Only now create the actual deployment workflow.

Keep it manually triggered first.

Example high-level flow:

```text
workflow_dispatch
-> build
-> login to ECR
-> docker build
-> docker push
-> create/update ECS task definition
-> update ECS service
-> wait for deployment
-> health verification
```

Do not merge this into the identity-check workflow.

## Phase 9 — Demo / Operations Runbook

Document:

```text
how to deploy
how to rollback
how to inspect CloudWatch logs
how to stop/delete resources
how to check cost/credits
how to rotate GitHub access keys
how to recover from a failed ECS deployment
```

---

# 21. What Codex Must Never Do Without Explicit Approval

```text
Create/join AWS Organizations
Upgrade the AWS account plan
Create a NAT Gateway
Enable Multi-AZ RDS
Create large RDS/Fargate instances
Create Provisioned IOPS
Enable ECS autoscaling
Create WAF
Create new long-term AWS access keys
Create Root access keys
Store secrets in source control
Run destructive DB seed/reset against RDS
Replace the identity-check workflow with a deployment workflow
Automatically deploy on every push before manual deployment is proven
Delete AWS resources without explicit approval
Change human IAM permissions without explicit approval
```

---

# 22. Equality Checklist for the Three Human Members

If the project keeps the current Root + 2 IAM model:

```text
[ ] Root MFA enabled
[ ] Carina is in Capstone-Admins
[ ] Dixon is in Capstone-Admins
[ ] Capstone-Admins has AdministratorAccess
[ ] Each IAM user has an independent password
[ ] Each IAM user has independent MFA
[ ] No shared IAM credentials
[ ] Billing IAM access enabled if delegated billing visibility is required
```

Result:

```text
Normal project AWS resource administration:
approximately equal

Root-only account ownership:
not equal by design
```

If the project wants literal daily-account equality:

```text
[ ] Create third human IAM user
[ ] Add third user to Capstone-Admins
[ ] Ensure all 3 human IAM users inherit only the same admin group policy
[ ] Give all 3 separate passwords/MFA
[ ] Use Root only for account-owner/emergency tasks
```

Result:

```text
Three human daily IAM identities:
same long-term authorization model
```

---

# 23. Access Key Policy

## Human users

Default:

```text
Console password + MFA
```

Only create an access key if that person actually needs CLI/SDK programmatic access.

If created:

```text
one unique key per IAM user
never shared
rotate/revoke when no longer needed
```

## GitHub

`github-actions-deploy` owns the deployment access key.

GitHub Environment `Main` stores:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

Do not copy this deployment key to teammates' local `.env` files unless there is a specific operational reason.

The machine identity should remain auditable as a machine identity.

---

# 24. Source-of-Truth Rules for Future Codex Sessions

When giving this document to Codex:

1. Codex must inspect the repository before modifying workflows.
2. Existing AWS identity verification is considered complete and separate.
3. No deployment should begin until build validation is green.
4. No destructive database step is allowed.
5. No cost-bearing architecture expansion is allowed without explicit approval.
6. The current Free Plan / no-Organizations constraint overrides generic AWS best-practice suggestions that would create an Organization.
7. The current deliberate use of long-term GitHub AWS access keys must be respected unless the team explicitly decides to migrate to OIDC.
8. “Three human accounts equal” means same day-to-day IAM administration policy; Root remains a separate account-owner concept.
9. Do not assume a successful STS identity check means the deployment user has every deployment permission.
10. Always report exactly which AWS resources a proposed step will create and which of them can incur ongoing hourly/storage/network costs before provisioning.

---

# 25. Current Identity Diagram

```text
                     AWS Account 448678332746
                              |
             +----------------+----------------+
             |                                 |
          Root user                            IAM
     account owner identity                    |
                                               |
                                +--------------+------------------+
                                |                                 |
                         Capstone-Admins                  github-actions-deploy
                                |                          machine identity
                         AdministratorAccess                    |
                                |                               |
                          +-----+-----+                         |
                          |           |                         |
                       Carina       Dixon                       |
                                                              |
                                                       Access Key Pair
                                                              |
                                                              v
                                                     GitHub Environment
                                                           Main
                                                              |
                                           +------------------+------------------+
                                           |                                     |
                                AWS_ACCESS_KEY_ID                    AWS_SECRET_ACCESS_KEY
                                           |
                                           +------------------+
                                                              |
                                                        AWS_REGION
                                                        us-east-1
                                                              |
                                                              v
                                                       GitHub Actions
                                                              |
                                                              v
                                                    sts:GetCallerIdentity
                                                              |
                                                              v
                                                     Account 448678332746
```

If literal human equality is adopted:

```text
Root
-> emergency/account-owner only

Capstone-Admins
-> AdministratorAccess
   |-- Human 1
   |-- Human 2
   `-- Human 3

github-actions-deploy
-> separate machine identity
```

---

# 26. Official AWS References

AWS Root user best practices:
https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html

AWS IAM security best practices:
https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html

AWS security credentials:
https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html

AWS managed AdministratorAccess job-function policy:
https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_job-functions.html

IAM access keys:
https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html

AWS Billing IAM access:
https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/control-access-billing.html

AWS Free Plan:
https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html

AWS Free Tier FAQs:
https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-FAQ.html

IAM Identity Center enablement / Free Plan warning:
https://docs.aws.amazon.com/singlesignon/latest/userguide/enable-identity-center.html

---

# 27. One-Sentence Policy

> TripSync uses one standalone AWS Free Plan account, three humans should have the same long-term day-to-day administrator policy through `Capstone-Admins` if literal equality is required, Root remains a separate account-owner identity, and GitHub Actions uses the separate long-term `github-actions-deploy` machine credential stored only in GitHub Environment `Main`.
