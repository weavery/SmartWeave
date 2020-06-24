import Arweave from 'arweave/node';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { getContract } from './contract-load';
import { replayToState } from './contract-replay';
import { execute, ContractInteraction } from './contract-step';

/**
 * Writes an interaction on the blockchain.
 *
 * This simply creates an interaction tx and posts it.
 * It does not need to know the current state of the contract.
 *
 * @param arweave       an Arweave client instance
 * @param wallet        a wallet private key
 * @param contractId    the Transaction Id of the contract
 * @param input         the interaction input, will be serialized as Json.
 */
export async function interactWrite(arweave: Arweave, wallet: JWKInterface, contractId: string, input: any) {
  
  // Use a random value in the data body. We must put
  // _something_ in the body, because a tx must have data or target
  // to be valid. The value doesn't matter, but something sorta random
  // helps because it will generate a different txid.
  let interactionTx = await arweave.createTransaction(
    {
      data: Math.random()
        .toString()
        .slice(-4)
    },
    wallet
  );

  if (!input) {
    throw new Error(`Input should be a truthy value: ${JSON.stringify(input)}`);
  }  

  interactionTx.addTag('App-Name', 'SmartWeaveAction');
  interactionTx.addTag('App-Version', '0.3.0');
  interactionTx.addTag('Contract', contractId);
  interactionTx.addTag('Input', JSON.stringify(input));

  await arweave.transactions.sign(interactionTx, wallet);

  const response = await arweave.transactions.post(interactionTx);

  if (response.status != 200) return false;

  return interactionTx.id;
}

/**
 * This will load a contract to its latest state, and do a dry run of an interaction,
 * without writing anything to the chain. This also can be used to do interactions that
 * dont change any state.
 *
 * @param arweave       an Arweave client instance
 * @param wallet        a wallet private or public key
 * @param contractId    the Transaction Id of the contract
 * @param input         the interaction input.
 */
export async function interactWriteDryRun(arweave: Arweave, wallet: JWKInterface, contractId: string, input: any) {
  const contractInfo = await getContract(arweave, contractId);
  const latestState = await replayToState(arweave, contractId);
  const from = await arweave.wallets.jwkToAddress(wallet);

  const interaction: ContractInteraction = {
    input: input,
    caller: from
  };

  return execute(contractInfo.handler, interaction, latestState);
}