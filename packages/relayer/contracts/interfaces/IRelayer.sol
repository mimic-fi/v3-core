// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity >=0.8.0;

/**
 * @dev Relayer interface
 */
interface IRelayer {
    /**
     * @dev The parameter is zero
     */
    error RelayerInputZero();

    /**
     * @dev The value sent and the amount differ
     */
    error RelayerDepositInvalidAmount(uint256 value, uint256 amount);

    /**
     * @dev The smart vault balance is lower than the amount to withdraw
     */
    error RelayerWithdrawSvInsufficientBal(uint256 amount, uint256 balance);

    /**
     * @dev It failed to send the amount to the sender
     */
    error RelayerWithdrawFailed(address sender, uint256 amount);

    /**
     * @dev The sender is not allowed
     */
    error RelayerExecutorNotAllowed(address sender);

    /**
     * @dev Empty tasks array or a mismatch between the parameters length for an execution
     */
    error RelayerExecuteInputBadLength(uint256 tasksLength, uint256 datasLength);

    /**
     * @dev The task's smart vault is wrong or the smart vault is not allowed to execute the task
     */
    error RelayerInvalidTask(address task, address smartVault);

    /**
     * @dev The smart vault balance plus the available quota are lower than the amount to pay the relayer
     */
    error RelayerPaymentSvInsufficientBal(uint256 amount, uint256 balance, uint256 availableQuota);

    /**
     * @dev It failed to send amount minus quota to the smart vault's collector
     */
    error RelayerCollectorFailed(address smartVault, uint256 amount, uint256 quota);

    /**
     * @dev Emitted every time an executor is configured
     */
    event ExecutorSet(address indexed executor, bool allowed);

    /**
     * @dev Emitted every time the default collector is set
     */
    event DefaultCollectorSet(address indexed collector);

    /**
     * @dev Emitted every time a collector is set for a smart vault
     */
    event SmartVaultCollectorSet(address indexed smartVault, address indexed collector);

    /**
     * @dev Emitted every time a smart vault's maximum quota is set
     */
    event SmartVaultMaxQuotaSet(address indexed smartVault, uint256 maxQuota);

    /**
     * @dev Emitted every time a smart vault's task is executed
     */
    event TaskExecuted(
        address indexed smartVault,
        address indexed task,
        bytes data,
        bool success,
        bytes result,
        uint256 gas
    );

    /**
     * @dev Emitted every time some native tokens are deposited for the smart vault's balance
     */
    event Deposited(address indexed smartVault, uint256 amount);

    /**
     * @dev Emitted every time some native tokens are withdrawn from the smart vault's balance
     */
    event Withdrawn(address indexed smartVault, uint256 amount);

    /**
     * @dev Emitted every time some ERC20 tokens are withdrawn from the relayer to an external account
     */
    event FundsRescued(address indexed token, address indexed recipient, uint256 amount);

    /**
     * @dev Emitted every time a smart vault's quota is paid
     */
    event QuotaPaid(address indexed smartVault, uint256 amount);

    /**
     * @dev Emitted every time a smart vault pays for transaction gas to the relayer
     */
    event GasPaid(address indexed smartVault, uint256 amount, uint256 quota);

    /**
     * @dev Tells the default collector address
     */
    function defaultCollector() external view returns (address);

    /**
     * @dev Tells whether an executor is allowed
     * @param executor Address of the executor being queried
     */
    function isExecutorAllowed(address executor) external view returns (bool);

    /**
     * @dev Tells the smart vault available balance to relay transactions
     * @param smartVault Address of the smart vault being queried
     */
    function getSmartVaultBalance(address smartVault) external view returns (uint256);

    /**
     * @dev Tells the custom collector address set for a smart vault
     * @param smartVault Address of the smart vault being queried
     */
    function getSmartVaultCollector(address smartVault) external view returns (address);

    /**
     * @dev Tells the smart vault maximum quota to be used
     * @param smartVault Address of the smart vault being queried
     */
    function getSmartVaultMaxQuota(address smartVault) external view returns (uint256);

    /**
     * @dev Tells the smart vault used quota
     * @param smartVault Address of the smart vault being queried
     */
    function getSmartVaultUsedQuota(address smartVault) external view returns (uint256);

    /**
     * @dev Tells the collector address applicable for a smart vault
     * @param smartVault Address of the smart vault being queried
     */
    function getApplicableCollector(address smartVault) external view returns (address);

    /**
     * @dev Configures an external executor
     * @param executor Address of the executor to be set
     * @param allowed Whether the given executor should be allowed or not
     */
    function setExecutor(address executor, bool allowed) external;

    /**
     * @dev Sets the default collector
     * @param collector Address of the new default collector to be set
     */
    function setDefaultCollector(address collector) external;

    /**
     * @dev Sets a custom collector for a smart vault
     * @param smartVault Address of smart vault to set a collector for
     * @param collector Address of the collector to be set for the given smart vault
     */
    function setSmartVaultCollector(address smartVault, address collector) external;

    /**
     * @dev Sets a maximum quota for a smart vault
     * @param smartVault Address of smart vault to set a maximum quota for
     * @param maxQuota Maximum quota to be set for the given smart vault
     */
    function setSmartVaultMaxQuota(address smartVault, uint256 maxQuota) external;

    /**
     * @dev Deposits native tokens for a given smart vault
     * @param smartVault Address of smart vault to deposit balance for
     * @param amount Amount of native tokens to be deposited, must match msg.value
     */
    function deposit(address smartVault, uint256 amount) external payable;

    /**
     * @dev Withdraws native tokens from a given smart vault
     * @param amount Amount of native tokens to be withdrawn
     */
    function withdraw(uint256 amount) external;

    /**
     * @dev Executes a list of tasks
     * @param tasks Addresses of the tasks to execute
     * @param datas List of calldata to execute each of the given tasks
     * @param continueIfFailed Whether the execution should fail in case one of the tasks fail
     */
    function execute(address[] memory tasks, bytes[] memory datas, bool continueIfFailed) external;

    /**
     * @dev Withdraw ERC20 tokens to an external account. To be used in case of accidental token transfers.
     * @param token Address of the token to be withdrawn
     * @param recipient Address where the tokens will be transferred to
     * @param amount Amount of tokens to withdraw
     */
    function rescueFunds(address token, address recipient, uint256 amount) external;
}
