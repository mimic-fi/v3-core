import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { Contract, ContractFactory } from 'ethers'
import { getContractAddress } from 'ethers/lib/utils'
import { Artifacts } from 'hardhat/internal/artifacts'
import { Artifact, LinkReferences } from 'hardhat/types'
import path from 'path'

import { getSigner } from './signers'

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

export type Libraries = { [key: string]: string }

export type ArtifactLike = { abi: any; bytecode: string; linkReferences?: LinkReferences }

const MINIMAL_PROXY_BYTECODE = `0x3d602d80600a3d3981f3363d3d373d3d3d363d73_IMP_5af43d82803e903d91602b57fd5bf3`

export async function deploy(
  nameOrArtifact: string | ArtifactLike,
  args: Array<any> = [],
  from?: SignerWithAddress,
  libraries?: Libraries
): Promise<Contract> {
  if (!args) args = []
  if (!from) from = await getSigner()
  const factory = await getFactoryContract(nameOrArtifact, libraries)
  const instance = await factory.connect(from).deploy(...args)
  return instance.deployed()
}

export async function deployProxy(
  nameOrArtifact: string | ArtifactLike,
  args: Array<any> = [],
  initArgs: Array<any> = [],
  initName = 'initialize',
  from?: SignerWithAddress,
  libraries?: Libraries
): Promise<Contract> {
  const implementation = await deploy(nameOrArtifact, args, from, libraries)
  const proxyBytecode = MINIMAL_PROXY_BYTECODE.replace('_IMP_', implementation.address.slice(2))

  if (!from) from = await getSigner()
  const addressQuery = { from: from.address, nonce: await from.getTransactionCount() }
  await from.sendTransaction({ data: proxyBytecode })
  const instance = await instanceAt(nameOrArtifact, await getContractAddress(addressQuery))
  await instance[initName](...initArgs)
  return instance
}

export async function getCreationCode(
  nameOrArtifact: string | ArtifactLike,
  args: Array<any> = [],
  libraries?: Libraries
): Promise<string> {
  if (!args) args = []
  const contractFactory = await getFactoryContract(nameOrArtifact, libraries)
  const transaction = await contractFactory.getDeployTransaction(...args)
  return transaction.data?.toString() || '0x'
}

async function getFactoryContract(
  nameOrArtifact: string | ArtifactLike,
  libraries: Libraries | undefined
): Promise<ContractFactory> {
  const artifact = typeof nameOrArtifact === 'string' ? await getArtifact(nameOrArtifact) : nameOrArtifact
  if (libraries !== undefined) artifact.bytecode = linkBytecode(artifact, libraries)
  return getFactoryContractForBytecode(nameOrArtifact, artifact.bytecode)
}

async function getFactoryContractForBytecode(
  nameOrArtifact: string | ArtifactLike,
  bytecode: string
): Promise<ContractFactory> {
  const artifact = typeof nameOrArtifact === 'string' ? await getArtifact(nameOrArtifact) : nameOrArtifact
  const { ethers } = await import('hardhat')
  return ethers.getContractFactory(artifact.abi, bytecode)
}

export async function instanceAt(nameOrArtifact: string | any, address: string): Promise<Contract> {
  const { ethers } = await import('hardhat')
  const artifact = typeof nameOrArtifact === 'string' ? await getArtifact(nameOrArtifact) : nameOrArtifact
  return ethers.getContractAt(artifact.abi, address)
}

export async function getArtifact(contractName: string): Promise<Artifact> {
  const artifactsPath = !contractName.includes('/')
    ? path.resolve('./artifacts')
    : path.dirname(require.resolve(`${contractName}.json`))
  const artifacts = new Artifacts(artifactsPath)
  return artifacts.readArtifact(contractName.split('/').slice(-1)[0])
}

export function linkBytecode(artifact: ArtifactLike, libraries: Libraries): string {
  let bytecode = artifact.bytecode.replace('0x', '')
  for (const [, fileReferences] of Object.entries(artifact.linkReferences || {})) {
    for (const [library, fixups] of Object.entries(fileReferences)) {
      const address = libraries[library]
      if (address === undefined) continue
      for (const fixup of fixups) {
        const pre = bytecode.substring(0, fixup.start * 2)
        const post = bytecode.substring((fixup.start + fixup.length) * 2)
        bytecode = pre + address.replace('0x', '') + post
      }
    }
  }
  return `0x${bytecode}`
}
