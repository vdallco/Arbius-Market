
import "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/master/contracts/token/ERC20/ERC20.sol";

contract ArbiusBribeMarket{
    // reentrancyGuard //
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status;

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
    ///////////////////////

    struct TokenDeposit{
        address validator;
        address token;
        uint256 tokenAmount;
        uint256 tokenToAIUSRatio;
        uint256 expiration;
    }

    event BribeAdded(uint256 indexed bribeId, address indexed sender, uint256 epoch);
    event BribeRemoved(uint256 indexed bribeId, address indexed sender, uint256 epoch);
    event BribeClaimed(uint256 indexed bribeId, address indexed sender, uint256 epoch);
    event FeeRecipientUpdated(address indexed sender, address newFeeRecipient, address oldFeeRecipient, uint256 epoch);
    event FeePerClaimUpdated(address indexed sender, uint256 newFeePerClaim, uint256 oldFeePerClaim, uint256 epoch);
    event VaultCreated(address indexed sender, uint256 epoch);

    mapping(uint256 => TokenDeposit) public deposits; 
    address[] public validators;
    uint256 public validatorIndex = 0;
    uint256 public depositIndex = 0;

    mapping(address => bool) public rewardTokens;
    // ["0x0000000000000000000000000000000000000000","0x750ba8b76187092B0D1E87E28daaf484d1b5273b"]
    
    address public arbiusEngine; // Mainnet:0x399511edeb7ca4a8328e801b1b3d0fe232abc996 // Testnet: 0x288d6dc01798e19f1120f32ccaa49ac6e38a4c4d
    uint256 public bribeLength = 31536000; // 365 days

    address public AIUS = 0xe3DBC4F88EAa632DDF9708732E2832EEaA6688AB; // Testnet: 0x9d9F1E12A937D900C8BED1F109DFC22218D0f354

    address public feeRecipient;
    uint256 public feePerClaimDivisor = 10;
    uint256 public feePerClaimDivisorMin = 5; // divisor of 5 means highest possible fee is 20%
    address public owner;

    function setAllowToken(address token, bool allowed) external onlyOwner {
        require(rewardTokens[token] != allowed, "reward token already configured");
        rewardTokens[token] = allowed;
    }

    constructor(address _owner, address _arbiusEngine, address _AIUS, address _feeRecipient, uint256 _feePerClaimDivisor, address[] memory rewardTokensAllowed) public {
        arbiusEngine = _arbiusEngine;
        AIUS = _AIUS;
        require(_feePerClaimDivisor >= feePerClaimDivisorMin, "fee is too high");
        feeRecipient = _feeRecipient;
        feePerClaimDivisor = _feePerClaimDivisor;
        owner = _owner;
        for(uint256 x = 0; x<rewardTokensAllowed.length;x++){
            rewardTokens[rewardTokensAllowed[x]] = true;
        }
        emit VaultCreated(msg.sender, block.timestamp);
        emit FeeRecipientUpdated(msg.sender, _feeRecipient, address(0), block.timestamp);
        emit FeePerClaimUpdated(msg.sender, _feePerClaimDivisor, 0, block.timestamp);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "onlyOnwer");
        _;
    }

    function setArbiusEngine(address newArbiusEngine) public onlyOwner {
        require(newArbiusEngine != arbiusEngine, "same arbius engine");
        arbiusEngine = newArbiusEngine;
    }

    function setFeeRecipient(address newFeeRecipient) public onlyOwner {
        require(newFeeRecipient != feeRecipient, "same recipient");
        emit FeeRecipientUpdated(msg.sender, newFeeRecipient, feeRecipient, block.timestamp);
        feeRecipient = newFeeRecipient;
    }

    function setFeePerClaim(uint256 newFeePerClaim) public onlyOwner {
        require(newFeePerClaim >= feePerClaimDivisor, "new fee must be lower than existing fee");
        require(newFeePerClaim >= feePerClaimDivisorMin, "new fee is too high");
        emit FeePerClaimUpdated(msg.sender, newFeePerClaim, feePerClaimDivisor, block.timestamp);
        feePerClaimDivisor = newFeePerClaim;
    }

    function depositBribe(address bribeToken, uint256 bribeAmount, uint256 tokenToValidatorRatio, address validator) public payable nonReentrant {
        require(rewardTokens[bribeToken], "reward token not allowed");
        uint256 sizeOfBribeTokenContract;
        assembly {
            sizeOfBribeTokenContract := extcodesize(bribeToken)
        }
        require(sizeOfBribeTokenContract > 0 || bribeToken == address(0), "bribe token is invalid"); // zero-addr is native ETH
        require(tokenToValidatorRatio>0, "token to validator ratio must be non-zero");
        require(bribeAmount>0, "Bribe amount must be non-zero");
        
        if (bribeToken==address(0)) { // native ETH
            require(msg.value == bribeAmount, "msg value must equal bribeAmount");
        }else{
            (bool success) = ERC20(bribeToken).transferFrom(msg.sender, address(this), bribeAmount);
            require(success, "ERC-20 transferFrom not successful");
        }

        uint256 expirationSeconds = block.timestamp + bribeLength;
        deposits[depositIndex] = TokenDeposit(validator, bribeToken, bribeAmount, tokenToValidatorRatio, expirationSeconds);
        emit BribeAdded(depositIndex, msg.sender, block.timestamp);
        depositIndex = depositIndex + 1;
        
    }

    function withdrawRemainingBribe(uint256 depositId) public nonReentrant {
        TokenDeposit storage deposit = deposits[depositId];
        require(deposit.validator == msg.sender, "only validator may withdraw bribes");
        require(deposit.tokenAmount > 0, "bribe is empty");
        uint256 amount = deposit.tokenAmount;
        deposit.tokenAmount = 0;
        deposits[depositId] = deposit;
        emit BribeRemoved(depositId, msg.sender, block.timestamp);

        if (deposit.token == address(0)){ // native ETH
            (bool success, bytes memory data) = deposit.validator.call{value: amount}("");
            require(success, "send eth not successful");
        }else{
            (bool success) = ERC20(deposit.token).transfer(deposit.validator, amount);
            require(success, "ERC-20 transfer not successful");
        }

        delete deposits[depositId];
    }

    function claim(address validator, uint256 aiusAmount) public nonReentrant {
        uint256 currentTimestamp = block.timestamp;
        (bool approveSuccess) = ERC20(AIUS).approve(arbiusEngine, aiusAmount);
        require(approveSuccess, "aius approval not successful");

        (bool aiusTransferSuccess) = ERC20(AIUS).transferFrom(msg.sender, address(this), aiusAmount);
        require(aiusTransferSuccess, "AIUS transferFrom not successful");

        (bool success, ) = arbiusEngine.call(abi.encodeWithSignature("validatorDeposit(address,uint256)", validator, aiusAmount));
        require(success, "aius could not be deposited to arbius engine");

        for (uint256 bribeId = 0; bribeId < depositIndex; bribeId++){
            if (deposits[bribeId].validator != validator){
                continue;
            }
            uint256 ratio = deposits[bribeId].tokenToAIUSRatio;
            uint256 amount = (ratio * aiusAmount)/(10**18);
            uint256 feeAmount = 0;

            if (deposits[bribeId].tokenAmount < amount){ // this must be done before fee calculations
                amount = deposits[bribeId].tokenAmount; // if we don't have enough, just give the remaining
            }
            if(feePerClaimDivisor > 0){
                feeAmount = amount / feePerClaimDivisor;
            }
            if(feeAmount > 0){
                if (deposits[bribeId].token == address(0)) { // native ETH
                    (bool success, bytes memory data) = feeRecipient.call{value: feeAmount}("");
                }else{
                    ERC20(deposits[bribeId].token).transfer(feeRecipient, feeAmount);
                }
            }
            if (amount <= 0) {
                continue; // skip any bribes where claim amount is less than or equal to 0
            }
            if (currentTimestamp > deposits[bribeId].expiration){
                continue;
            }

            deposits[bribeId].tokenAmount = deposits[bribeId].tokenAmount - amount;
            
            if (deposits[bribeId].token == address(0)) { // native ETH
                (bool success, bytes memory data) = msg.sender.call{value: amount - feeAmount}("");
            }else{
                (bool success) = ERC20(deposits[bribeId].token).transfer(msg.sender, amount - feeAmount);
            }
            
            if(deposits[bribeId].tokenAmount == 0){
                emit BribeRemoved(bribeId, msg.sender, block.timestamp);
                delete deposits[bribeId];
            }
            
            emit BribeClaimed(bribeId, msg.sender, block.timestamp);
        }
    }
}