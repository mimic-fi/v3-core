import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract, ContractTransaction } from 'ethers'

type NAry<T> = T | Array<T>

type Account = string | Contract | SignerWithAddress

export type PermissionParam = {
  op: number
  value: string | number
}

export type GrantPermission = {
  who: NAry<Account>
  what: string
  params: PermissionParam[]
}

export type RevokePermission = {
  who: NAry<Account>
  what: string
}

export type PermissionChange = {
  where: Contract
  grants: GrantPermission[]
  revokes: RevokePermission[]
}

export async function executePermissionChanges(
  authorizer: Contract,
  changes: PermissionChange[],
  from: SignerWithAddress
): Promise<ContractTransaction> {
  const parsedChanges = reducePermissionChanges(changes)
  const tx = await authorizer.connect(from).execute(parsedChanges)
  await tx.wait()
  return tx
}

function reducePermissionChanges(changes: PermissionChange[]) {
  return changes.map((change: PermissionChange) => {
    const where = change.where.address
    const grants = reduceGrantPermissions(change.grants, change.where)
    const revokes = reduceRevokePermissions(change.revokes, change.where)
    return { where, grants, revokes }
  })
}

function reduceGrantPermissions(grants: GrantPermission[], where: Contract) {
  return grants.reduce((all: GrantPermission[], grant) => {
    const what = where.interface.getSighash(grant.what)
    if (Array.isArray(grant.who)) {
      return all.concat(grant.who.map((who: Account) => ({ who: toAddress(who), what, params: grant.params })))
    } else {
      return all.concat({ who: toAddress(grant.who), what, params: grant.params })
    }
  }, [])
}

function reduceRevokePermissions(revokes: RevokePermission[], where: Contract) {
  return revokes.reduce((all: RevokePermission[], revoke) => {
    const what = where.interface.getSighash(revoke.what)
    if (Array.isArray(revoke.who)) {
      return all.concat(revoke.who.map((who: Account) => ({ who: toAddress(who), what })))
    } else {
      return all.concat({ who: toAddress(revoke.who), what })
    }
  }, [])
}

function toAddress(account: Account): string {
  return typeof account == 'string' ? account : account.address
}
