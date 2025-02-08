import https from 'https'

import { SignJWT, importPKCS8 } from 'jose'

export const iamTokenRequest: (jwt: string)=> Promise<{ iamToken: string }> = (jwt) => new Promise((resolve, reject) => {
  const req = https.request({
    hostname: 'iam.api.cloud.yandex.net',
    path: '/iam/v1/tokens',
    method: 'POST',
    headers: {
      'content-Type': 'application/json',
    },
  }, (res) => {
    const chunks: Uint8Array<ArrayBufferLike>[] = []
    res.on('data', (data: Buffer) => chunks.push(data))
    res.on('end', () => {
      const resBody = Buffer.concat(chunks)
      const data = JSON.parse(resBody.toString('utf-8'))
      if (!data.iamToken) {
        return reject(data.message)
      }

      return resolve(data)
    })
  })
  req.on('error', reject)
  req.write(JSON.stringify({ jwt }))
  req.end()
})

export const jwt = async (credential: {
  serviceAccountId: string;
  accessKeyId: string;
  privateKey: Buffer;
  iamEndpoint: string;
}) => {
  const now = Math.floor(new Date().getTime() / 1000)

  const key = await importPKCS8(credential.privateKey.toString('utf-8')
    .replace(/PLEASE DO NOT REMOVE THIS LINE!.+?\n/, ''), 'PS256')

  const jwtJose = new SignJWT({
    aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens',
    iss: credential.serviceAccountId,
    iat: now,
    exp: now + 3600,
  })
  jwtJose.setProtectedHeader({
    alg: 'PS256',
    kid: credential.accessKeyId,
  })
  const jwtToken = await jwtJose.sign(key)
  return jwtToken
}
