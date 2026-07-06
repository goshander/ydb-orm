import { CredentialsProvider } from '@ydbjs/auth'
import { type RetryConfig, retry } from '@ydbjs/retry'
import { backoff } from '@ydbjs/retry/strategy'
import { importPKCS8, SignJWT } from 'jose'

type IamCredentialsToken = {
  value: string
  expired_at: number
}

export type IamCredentials = {
  iamEndpoint?: string
  serviceAccountId: string
  accessKeyId: string
  privateKey: Buffer
}

export class IamCredentialsProvider extends CredentialsProvider {
  #promise: Promise<string> | null = null
  #token: IamCredentialsToken | null = null

  #iamEndpoint: string = 'iam.api.cloud.yandex.net'
  #serviceAccountId: string = ''
  #accessKeyId: string = ''
  #privateKey: Buffer

  constructor(credentials: IamCredentials) {
    super()
    this.#serviceAccountId = credentials.serviceAccountId
    this.#accessKeyId = credentials.accessKeyId
    this.#privateKey = credentials.privateKey

    if (credentials.iamEndpoint) {
      this.#iamEndpoint = credentials.iamEndpoint
    }
  }

  private jwt = async () => {
    const now = Date.now()
    const expiredAt = now + 3600 * 1000

    const key = await importPKCS8(
      this.#privateKey
        .toString('utf-8')
        .replace(/PLEASE DO NOT REMOVE THIS LINE!.+?\n/, ''),
      'PS256',
    )

    const jwtJose = new SignJWT({
      aud: `https://${this.#iamEndpoint}/iam/v1/tokens`,
      iss: this.#serviceAccountId,
      iat: now,
      exp: Math.floor(expiredAt / 1000),
    })
    jwtJose.setProtectedHeader({
      alg: 'PS256',
      kid: this.#accessKeyId,
    })
    const jwtToken = await jwtJose.sign(key)
    return { token: jwtToken, expiredAt }
  }

  getToken(force?: boolean, signal?: AbortSignal): Promise<string> {
    if (!force && this.#token && this.#token.expired_at > Date.now()) {
      return Promise.resolve(this.#token.value)
    }

    if (this.#promise) {
      return this.#promise
    }

    const retryConfig: RetryConfig = {
      retry: (err) => err instanceof Error,
      signal,
      budget: 5,
      strategy: backoff(10, 1000),
    }

    this.#promise = retry(retryConfig, async (abSignal) => {
      const jwt = await this.jwt()

      const response = await fetch(
        `https://${this.#iamEndpoint}/iam/v1/tokens`,
        {
          method: 'POST',
          headers: {
            'content-Type': 'application/json',
          },
          body: JSON.stringify({ jwt: jwt.token }),
          signal: abSignal,
        },
      )

      if (!response.ok) {
        throw new Error(
          `ydb: [IAM] failed to fetch token: ${response.status} ${response.statusText}`,
        )
      }

      const token = JSON.parse(await response.text()) as { iamToken?: string }
      if (!token.iamToken) {
        throw new Error('ydb: [IAM] no access token exists in response')
      }

      this.#token = {
        value: token.iamToken,
        expired_at: jwt.expiredAt,
      }

      return this.#token.value
    }).finally(() => {
      this.#promise = null
    })

    return this.#promise
  }
}
