"use client";

import React, { useState, useEffect } from 'react';

export default function Home() {
  const [status, setStatus] = useState<string>('Loading...');
  const [accounts, setAccounts] = useState<{ address: string; meta: { name?: string; source: string } }[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('');
  const [hotkey, setHotkey] = useState<string>(() => {
    const envValue = process.env.NEXT_PUBLIC_VALIDATOR_ADDRESS;
    return typeof envValue === 'string' ? envValue : '';
  });
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [currentStake, setCurrentStake] = useState<number>(0);

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

  const fetchStakeAmount = async () => {
    if (selectedAccount && hotkey) {
      try {
        const { ApiPromise, WsProvider } = await import('@polkadot/api');
        const provider = new WsProvider('wss://test.finney.opentensor.ai:443');
        const api = await ApiPromise.create({ provider });
        
        const res = await api.query.subtensorModule.stake(hotkey, selectedAccount);
        if (res.isEmpty) {
          setCurrentStake(0);
        } else {
          const amount = parseFloat(res.toString()) / 1000000000;
          setCurrentStake(amount);
        }
      } catch (error) {
        console.error('Error fetching stake amount:', error);
      }
    }
  };

  const fetchBalance = async () => {
    if (selectedAccount) {
      try {
        const { ApiPromise, WsProvider } = await import('@polkadot/api');
        const provider = new WsProvider('wss://test.finney.opentensor.ai:443');
        const api = await ApiPromise.create({ provider });

        const accountInfo = await api.query.system.account(selectedAccount);
        const { data: { free } } = accountInfo;
        const freeInTao = free.toBigInt() / BigInt(10 ** 9);
        setBalance(`${freeInTao}`);
        setStakeAmount(`${freeInTao}`); // Set default stake amount to balance
      } catch (error) {
        console.error('Error fetching balance:', error);
        setBalance('Error fetching balance');
      }
    }
  };

  useEffect(() => {
    fetchBalance()

    if (selectedAccount) {
      fetchBalance();
    }
  }, [selectedAccount]);

  useEffect(() => {
    if (selectedAccount && hotkey) {
      fetchStakeAmount();
    }
  }, [selectedAccount, hotkey]);

  const handleAccountSelect = (accountAddress: string) => {
    setSelectedAccount(accountAddress);
  };

  const handleStakeAction = async (action: 'add' | 'remove' | 'removeMax') => {
    if (selectedAccount && hotkey && stakeAmount) {
      try {
        const { ApiPromise, WsProvider } = await import('@polkadot/api');
        const { web3FromAddress } = await import('@polkadot/extension-dapp');

        const provider = new WsProvider('wss://test.finney.opentensor.ai:443');
        const api = await ApiPromise.create({ provider });
        
        const injector = await web3FromAddress(selectedAccount);
        
        let tx;
        if (action === 'add') {
          const taoAmountBigInt = BigInt(Math.floor(parseFloat(stakeAmount) * 1e9));
          tx = api.tx.subtensorModule.addStake(hotkey, taoAmountBigInt);
        } else if (action === 'remove') {
          const taoAmountBigInt = BigInt(Math.floor(parseFloat(stakeAmount) * 1e9));
          tx = api.tx.subtensorModule.removeStake(hotkey, taoAmountBigInt);
        } else { // removeMax
          tx = api.tx.subtensorModule.removeStake(hotkey, currentStake * 1e9);
        }

        await tx.signAndSend(selectedAccount, { signer: injector.signer }, ({ status, dispatchError }) => {
          console.log('Transaction status:', status.toString());
          if (status.isFinalized && !dispatchError) {
            console.log(`Stake ${action === 'add' ? 'added' : 'removed'} successfully!`);
            console.log(status.asFinalized.toString())
            // Refresh balance after staking action
            fetchBalance();
            fetchStakeAmount();
          }
          if (dispatchError) {
            console.error(`Dispatch Error: ${dispatchError.toString()}`);
          }
        });
      } catch (error) {
        console.error(`Error ${action === 'add' ? 'adding' : 'removing'} stake:`, error);
      }
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Wallet Integration</h1>
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Status</h2>
        <p className="text-gray-700">{status}</p>
      </div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Accounts</h2>
        {accounts.length > 0 ? (
          <ul className="space-y-2">
            {accounts.map((account, index) => (
              <li 
                key={index} 
                onClick={() => handleAccountSelect(account.address)}
                className="p-2 border rounded cursor-pointer hover:bg-gray-100"
              >
                <strong>{account.meta?.name || 'Unnamed Account'}</strong> - {account.address}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-700">No accounts found.</p>
        )}
      </div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Balance</h2>
        {balance ? (
          <p className="text-gray-700">{`Balance: ${balance} τ`}</p>
        ) : (
          <p className="text-gray-700">Loading balance...</p>
        )}
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">Delegate to Foundry</h2>
        <input
          type="text"
          placeholder="Hotkey"
          value={hotkey}
          onChange={(e) => setHotkey(e.target.value)}
          className="border w-full rounded p-2 mr-2 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="mb-2">
          <p className="text-gray-700">Current Stake: {currentStake} τ</p>
        </div>
        <div className="flex space-x-2">
        <input
          type="number"
          placeholder="Stake Amount"
          value={stakeAmount}
          onChange={(e) => setStakeAmount(e.target.value)}
          className="border rounded p-2 mr-2 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
          <button 
            onClick={() => handleStakeAction('add')} 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Add Stake
          </button>
          <button 
            onClick={() => handleStakeAction('remove')} 
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Remove Stake
          </button>
          <button 
            onClick={() => handleStakeAction('removeMax')} 
            className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            Unstake Max Amount
          </button>
        </div>
      </div>
    </div>
  );
}