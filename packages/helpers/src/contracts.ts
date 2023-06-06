import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { Contract } from 'ethers'
import { Artifacts } from 'hardhat/internal/artifacts'
import { Artifact, LinkReferences } from 'hardhat/types'
import path from 'path'

import { getSigner } from './signers'

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

export type Libraries = { [key: string]: string }

export type ArtifactLike = { abi: any; bytecode: string; linkReferences?: LinkReferences }

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

async function getFactoryContract(nameOrArtifact: string | ArtifactLike, libraries: Libraries | undefined) {
  const artifact = typeof nameOrArtifact === 'string' ? await getArtifact(nameOrArtifact) : nameOrArtifact
  if (libraries !== undefined) artifact.bytecode = linkBytecode(artifact, libraries)
  const { ethers } = await import('hardhat')
  return ethers.getContractFactory(artifact.abi, artifact.bytecode)
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
