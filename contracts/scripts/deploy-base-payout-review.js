import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { network } from "hardhat"
import { encodeFunctionData } from "viem"

const environment=(process.env.FUNDLOOP_DEPLOYMENT_ENV??"production").trim().toLowerCase()
if(!["local","dev","test"].includes(environment))throw new Error("base payout deployment is non-production only")
const connection=await network.connect()
const {viem}=connection
const chainId=Number(await (await viem.getPublicClient()).getChainId())
if(![31337,84532].includes(chainId))throw new Error(`base payout chain ${chainId} is not allowed`)
const [deployer,limitedSigner]=await viem.getWalletClients()
const perTransaction=20_000_000n
const rolling24Hours=500_000_000n
const perEpoch=5_000_000_000n
let safeAddress
let platformSafeAddress
let tokenAddress
let localFixtureOnly=false
let limitedSignerAddress

if(chainId===31337){
  if(process.env.FUNDLOOP_ALLOW_LOCAL_PAYOUT_FIXTURE!=="true")throw new Error("FUNDLOOP_ALLOW_LOCAL_PAYOUT_FIXTURE=true is required")
  localFixtureOnly=true
  const safe=await viem.deployContract("MockSafe",[deployer.account.address],{client:{wallet:deployer}})
  const platformSafe=await viem.deployContract("MockSafe",[deployer.account.address],{client:{wallet:deployer}})
  const token=await viem.deployContract("MockERC20",["Mock USDC","USDC",6],{client:{wallet:deployer}})
  safeAddress=safe.address;platformSafeAddress=platformSafe.address;tokenAddress=token.address;limitedSignerAddress=limitedSigner.account.address
}else{
  safeAddress=process.env.BASE_SEPOLIA_EPOCH_SAFE_ADDRESS?.trim().toLowerCase()
  platformSafeAddress=process.env.BASE_SEPOLIA_PLATFORM_SAFE_ADDRESS?.trim().toLowerCase()
  tokenAddress="0x036cbd53842c5426634e7929541ec2318f3dcf7e"
  if(!safeAddress?.match(/^0x[0-9a-f]{40}$/))throw new Error("BASE_SEPOLIA_EPOCH_SAFE_ADDRESS is required")
  if(!platformSafeAddress?.match(/^0x[0-9a-f]{40}$/))throw new Error("BASE_SEPOLIA_PLATFORM_SAFE_ADDRESS is required")
  limitedSignerAddress=process.env.BASE_PAYOUT_LIMITED_SIGNER_ADDRESS?.trim().toLowerCase()
  if(!limitedSignerAddress?.match(/^0x[0-9a-f]{40}$/))throw new Error("BASE_PAYOUT_LIMITED_SIGNER_ADDRESS is required")
}

const paymaster=await viem.deployContract("FundLoopPaymasterBudget",[safeAddress,safeAddress,100_000n],{client:{wallet:deployer}})
const moduleContract=await viem.deployContract("FundLoopSafePayoutModule",[safeAddress,limitedSignerAddress,paymaster.address,
  perTransaction,rolling24Hours,perEpoch],{client:{wallet:deployer}})
if(chainId===31337){
  const safe=await viem.getContractAt("MockSafe",safeAddress)
  await safe.write.enableModule([moduleContract.address],{account:deployer.account})
  await safe.write.execOwnerTransaction([moduleContract.address,0n,encodeFunctionData({abi:moduleContract.abi,functionName:"setTokenAllowed",args:[tokenAddress,true]})],{account:deployer.account})
  await safe.write.execOwnerTransaction([paymaster.address,0n,encodeFunctionData({abi:paymaster.abi,functionName:"setController",args:[moduleContract.address]})],{account:deployer.account})
  await paymaster.write.fund([],{account:deployer.account,value:1_000_000n})
}
const manifest={contractVersion:"fundloop-base-safe-payout-review-v1",environment,chainId,safeRole:"epoch",safeAddress,platformSafeAddress,moduleAddress:moduleContract.address,
  paymasterPolicyAddress:paymaster.address,limitedSignerAddress,tokenSymbol:"USDC",tokenAddress,
  limits:{perTransaction:perTransaction.toString(),rolling24Hours:rolling24Hours.toString(),perEpoch:perEpoch.toString()},
  localFixtureOnly,moduleOwner:safeAddress,paymasterOwner:safeAddress,paymasterController:chainId===31337?moduleContract.address:safeAddress,
  safeEnablementRequired:chainId!==31337,isActive:chainId===31337,isPaused:false,productionValueFlowEnabled:false}
const outputDir=path.resolve("../output/deployments")
await mkdir(outputDir,{recursive:true})
await writeFile(path.join(outputDir,"base-payout-review.manifest.json"),`${JSON.stringify(manifest,null,2)}\n`)
console.log(JSON.stringify(manifest))
