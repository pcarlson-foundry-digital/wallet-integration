"use client";

import React, { useState, useEffect } from 'react';

export default function Home() {
  const [status, setStatus] = useState<string>('Loading...');
  const [accounts, setAccounts] = useState<{ address: string; meta: { name?: string; source: string } }[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('');

  useEffect(() => {
    const initializeWallet = async () => {
      try {
        const { web3Enable, web3Accounts } = await import('@polkadot/extension-dapp');
        
        const allInjected = await web3Enable('foundry-wallet-integration');
        if (allInjected.length === 0) {
          throw new Error('No injected extensions available.');
        }

        const allAccounts = await web3Accounts();
        setAccounts(allAccounts);

        if (allAccounts.length > 0) {
          setSelectedAccount(allAccounts[0].address);
          setStatus('Account found');
        } else {
          setStatus('No accounts found.');
        }
      } catch (error) {
        console.error('Failed to initialize wallet:', error);
        setStatus('Failed to initialize wallet.');
      }
    };

    initializeWallet();
  }, []);

  useEffect(() => {
    const fetchBalance = async () => {
      if (selectedAccount) {
        try {
          const { ApiPromise, WsProvider } = await import('@polkadot/api');
          const provider = new WsProvider('wss://test.finney.opentensor.ai:443');
          const api = await ApiPromise.create({ provider });

          const accountInfo = await api.query.system.account(selectedAccount);
          const { data: { free } } = accountInfo;
          const freeInTao = free.toBigInt() / BigInt(10 ** 9);
          setBalance(`${freeInTao} τ`);
        } catch (error) {
          console.error('Error fetching balance:', error);
          setBalance('Error fetching balance');
        }
      }
    };

    if (selectedAccount) {
      fetchBalance();
    }
  }, [selectedAccount]);

  const handleAccountSelect = (accountAddress: string) => {
    setSelectedAccount(accountAddress);
  };

  const handleAddStake = async () => {
    if (selectedAccount) {
      try {
        const { ApiPromise, WsProvider } = await import('@polkadot/api');
        const { web3FromAddress } = await import('@polkadot/extension-dapp');

        const provider = new WsProvider('wss://test.finney.opentensor.ai:443');
        const api = await ApiPromise.create({ provider });
        
        const injector = await web3FromAddress(selectedAccount);
        
        // These values should be dynamically set or passed as parameters
        const hotkey = 'your_hotkey_here';
        const desiredAmount = 1000;
        const currentStake = 500;
        const stakeAmount = desiredAmount - currentStake;

        const tx = api.tx.subtensorModule.addStake(hotkey, stakeAmount.toString());
        await tx.signAndSend(selectedAccount, { signer: injector.signer }, ({ status }) => {
          console.log('Transaction status:', status.toString());
          if (status.isFinalized) {
            console.log('Stake added successfully!');
          }
        });
      } catch (error) {
        console.error('Error adding stake:', error);
      }
    }
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
          <p>{`Balance: ${balance}`}</p>
        ) : (
          <p>Loading balance...</p>
        )}
      </div>
      <button onClick={handleAddStake}>Add Stake</button>
    </div>
  );
}