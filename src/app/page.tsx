"use client";

import { useState, useEffect } from 'react';
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp';
import { ApiPromise, WsProvider } from '@polkadot/api';

// Enable injected extensions
async function enableInjected(): Promise<void> {
  const allInjected = await web3Enable('my-cool-dapp');
  if (allInjected.length === 0) {
    throw new Error('No injected extensions available.');
  }
}

// Get all accounts from the injected extension
async function getAllAccounts(): Promise<{ address: string; meta: { name?: string; source: string } }[]> {
  const allAccounts = await web3Accounts();
  return allAccounts;
}

// Create a new instance of the Polkadot API
async function createApi(): Promise<ApiPromise> {
  const provider = new WsProvider('wss://test.finney.opentensor.ai:443');
  const api = await ApiPromise.create({ provider });
  return api;
}

async function addStake(api: ApiPromise, address: string, hotkey: string, desiredAmount: number, currentStake: number) {
  try {
    // Get the injector for signing the transaction
    const injector = await web3FromAddress(address);

    // Calculate the difference between desired amount and current stake
    const stakeAmount = desiredAmount - currentStake;

    // Create the transaction for adding stake
    const tx = api.tx.subtensorModule.addStake(hotkey, stakeAmount.toString()); // Convert to string as required

    // Sign and send the transaction
    await tx.signAndSend(address, { signer: injector.signer }, ({ status }) => {
      console.log('Transaction status:', status.toString());
      if (status.isFinalized) {
        console.log('Stake added successfully!');
      }
    });
  } catch (error) {
    console.error('Error adding stake:', error);
  }
}

// Get account balance
async function getBalance(api: ApiPromise, address: string) {
  try {
    // Fetch the account information from the blockchain
    const accountInfo = await api.query.system.account(address);
    
    // Log the full response to troubleshoot
    console.log('Account Info:', accountInfo.toHuman());

    const { data: { free } } = accountInfo;  // Destructure to get the free balance
    
    // Shift decimal 9 places to the left to get the balance in TAO
    const freeInTao = free.toBigInt() / BigInt(10 ** 9); // Convert free balance to BigInt and divide by 10^9
    
    // Log the balance in TAO
    console.log(`Balance in TAO: ${freeInTao}`);
    
    // Return the formatted balance with the τ symbol (lowercase tau letter)
    return `${freeInTao} τ`; // TAO symbol as the unit
  } catch (error) {
    console.error('Error fetching balance:', error);
    return 'Error fetching balance';
  }
}


export default function Home() {
  const [status, setStatus] = useState<string>('Loading...');
  const [accounts, setAccounts] = useState<{ address: string; meta: { name?: string; source: string } }[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('');

  // Fetch accounts and balance after enabling injected extensions
  useEffect(() => {
    const fetchAccountsAndBalance = async () => {
      try {
        await enableInjected();  // Enable the wallet extension
        const allAccounts = await getAllAccounts(); // Fetch accounts
        setAccounts(allAccounts);

        if (allAccounts.length > 0) {
          setSelectedAccount(allAccounts[0].address); // Default to first account
          setStatus('Account found');
        } else {
          setStatus('No accounts found.');
        }
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
        setStatus('Failed to fetch accounts.');
      }
    };

    fetchAccountsAndBalance();
  }, []); // Run only once on component mount

  // Fetch balance whenever a new account is selected
  useEffect(() => {
    const fetchBalance = async () => {
      if (selectedAccount) {
        const api = await createApi();
        const accountBalance = await getBalance(api, selectedAccount); // Get balance of selected account
        setBalance(accountBalance); // Set balance in state
      }
    };

    if (selectedAccount) {
      fetchBalance();
    }
  }, [selectedAccount]); // Re-run whenever selectedAccount changes

  const handleAccountSelect = (accountAddress: string) => {
    setSelectedAccount(accountAddress);
  };

  return (
    <div>
      <h1>Wallet Integration</h1>
      <div>
        <h2>Status</h2>
        <p>{status}</p>
      </div>
      <div>
        <h2>Accounts</h2>
        {accounts.length > 0 ? (
          <ul>
            {accounts.map((account, index) => (
              <li key={index} onClick={() => handleAccountSelect(account.address)}>
                <strong>{account.meta?.name || 'Unnamed Account'}</strong> - {account.address}
              </li>
            ))}
          </ul>
        ) : (
          <p>No accounts found.</p>
        )}
      </div>
      <div>
        <h2>Balance</h2>
        {balance ? (
          <p>{`Balance: ${balance}`}</p> // Display balance
        ) : (
          <p>Loading balance...</p>
        )}
      </div>
    </div>
  );
}
