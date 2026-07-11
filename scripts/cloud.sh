#!/bin/bash

# exit setup
set -eo pipefail
# [-e] - immediately exit if any command has a non-zero exit status
# [-x] - all executed commands are printed to the terminal [not secure]
# [-o pipefail] - if any command in a pipeline fails, that return code will be used as the return code of the whole pipeline

CONTEXT="$(pwd)"

if [ -z "${YC_PROFILE_NAME}" ]; then
  YC_PROFILE_NAME="${USER}"
fi

YC_PROFILE_EXISTS=$(yc config profile list 2>/dev/null | sed 's| ACTIVE||' | { grep -x "${YC_PROFILE_NAME}" || true; } | head -n1 | sed "s|${YC_PROFILE_NAME}|true|")

if [ "${YC_PROFILE_EXISTS}" != "true" ] && [ "${CI}" == "true" ]; then
  YC_PROFILE_NAME="${YC_PROFILE_NAME}-$(date +%s)"
fi

echo ""
echo "yc profile name: ${YC_PROFILE_NAME}"
echo "yc profile exists: ${YC_PROFILE_EXISTS}"
echo ""

if [ "${YC_PROFILE_EXISTS}" != "true" ] && [ ! -z "${YC_PROFILE_NAME}" ]; then
  echo "yc profile [${YC_PROFILE_NAME}] does not exists, creating..."

  if [ -z "${YC_CLOUD_ID}" ]; then
    echo "error: var [YC_CLOUD_ID] is empty, please fill it from env..."
    exit 1
  fi

  if [ -z "${YC_FOLDER_ID}" ]; then
    echo "error: var [FOLDER_ID] is empty, please fill it from env..."
    exit 1
  fi

  yc config profile create "${YC_PROFILE_NAME}" &>/dev/null || { echo "  profile create error" && exit 1; }
  yc --profile "${YC_PROFILE_NAME}" config set cloud-id "${YC_CLOUD_ID}" &>/dev/null || exit 1
  yc --profile "${YC_PROFILE_NAME}" config set folder-id "${YC_FOLDER_ID}" &>/dev/null || exit 1

  if [ -z "${YC_SA_FILE}" ]; then
    YC_SA_FILE="${CONTEXT}/sa-key.json"
  fi
  if [ -f "${YC_SA_FILE}" ] && [ -z "${YC_IAM_TOKEN}" ]; then
    echo "  detected service account file [${YC_SA_FILE}], adding to profile [${YC_PROFILE_NAME}]..."
    yc --profile "${YC_PROFILE_NAME}" config set service-account-key "${YC_SA_FILE}" &>/dev/null || exit 1
  elif [ ! -z "${YC_IAM_TOKEN}" ]; then
    echo "error: service account key file [${YC_SA_FILE}] does not exists, configure profile [${YC_PROFILE_NAME}] manually with YC CLI or provide service account key file, exit..."
    exit 1
  fi

  echo "ok: config yc profile [${YC_PROFILE_NAME}] success"
else
  YC_CLOUD_ID=$(yc --profile "${YC_PROFILE_NAME}" config get cloud-id)
  YC_FOLDER_ID=$(yc --profile "${YC_PROFILE_NAME}" config get folder-id)
fi

IAM_SERVICE_ACCOUNT_NAME="ydb-orm-test"
IAM_SERVICE_ACCOUNT_ID=$(yc iam service-account get --name "${IAM_SERVICE_ACCOUNT_NAME}" --profile "${YC_PROFILE_NAME}" --format json | jq -r '.id')
echo "service account id: ${IAM_SERVICE_ACCOUNT_ID}"
echo ""
IAM_TOKEN=$(yc --profile "${YC_PROFILE_NAME}" iam create-token --impersonate-service-account-id "${IAM_SERVICE_ACCOUNT_ID}")

export YC_IAM_TOKEN="${IAM_TOKEN}"
export YDB_TOKEN="${IAM_TOKEN}"

YDB_DATABASE="ydb-orm-test"
YDB_ENDPOINT=$(yc --cloud-id "${YC_CLOUD_ID}" --folder-id "${YC_FOLDER_ID}" ydb database get --name "${YDB_DATABASE}" --format json | jq -r '.endpoint')
export YDB_CONNECTION_STRING="${YDB_ENDPOINT}"

echo "run tests..."
echo ""

bun test --bail --timeout=30000 ./test/*.spec.ts
