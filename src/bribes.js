// Arbius Bribe Market

const ARBIUS_BRIBE_CONTRACT = '0x95186b68e3dD003445551791f2e3cECfb7D0100f'; //'0xb2af1C506cAc40D467fb96fCf97a3CA036Ac4E34';

const TEST_ARBIUS_BRIBE_CONTRACT = '0xa7016847E0285f15bf4449a2a260b379eB517100'; //'0x2c731886Eb2De9d10Cf951874EE914531c205CCe';

const ARBITRUM_NOVA_RPC = "https://arbitrum-nova.drpc.org";
const ARBITRUM_NOVA_EXPLORER_URL = 'https://nova.arbiscan.io/';


const TEST_AIUS_TOKEN = "0x9d9F1E12A937D900C8BED1F109DFC22218D0f354";
const TEST_ARBIUS_ENGINE = '0x288d6dc01798e19f1120f32ccaa49ac6e38a4c4d';

const AIUS_TOKEN = '0xe3DBC4F88EAa632DDF9708732E2832EEaA6688AB';
const ARBIUS_ENGINE = '0x399511EDEB7ca4A8328E801b1B3D0fe232aBc996'

const abi = ["function claim(address validator, uint256 aiusAmount) public returns ()",
                         "function depositIndex() public view returns (uint256)",
                        "function depositBribe(address bribeToken, uint256 bribeAmount, uint256 tokenToValidatorRatio, address validator) public payable returns ()",
                        "function deposits(uint256) public view returns (address, address, uint256, uint256, uint256)",
                        "function baseToken() public view returns (address)",
                        "function paused() public view returns (bool)"]

const ERC20_ABI = ["function approve(address,uint256) public returns ()",
                   "function balanceOf(address) public view returns (uint256)",
                   "function allowance(address,address) public view returns (uint256)",
                   "function decimals() public view returns (uint256)"];

const reward_tokens = {"0x0000000000000000000000000000000000000000":["ETH", 18],
                       "0x750ba8b76187092B0D1E87E28daaf484d1b5273b":["USDC", 6]}

const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_NOVA_RPC);


function shortenValidatorAddress(address){
  return "<a href='" + ARBITRUM_NOVA_EXPLORER_URL + "/address/" + address + "'>" + address.slice(0,4) + "..." + address.slice(-4) + "</a>"
}

const connectedWallet = () => {
  if (typeof window.ethereum !== "undefined") {
    let provider = window.ethereum;
    if (window.ethereum.providers?.length) {
      window.ethereum.providers.forEach(async (p) => {
        if (p.isMetaMask) provider = p;
      });
    }
    return new ethers.providers.Web3Provider(provider);
  }
};

async function checkConnected() {
        const provider = connectedWallet(); //new ethers.providers.Web3Provider(window.ethereum, "any");
        const signer = provider.getSigner();
        if (signer){
                try{
                  signerAddr = await signer.getAddress();
                  connectWallet.setAttribute('disabled','disabled');
                  connectWallet.innerHTML = 'Connected';
                  M.toast({html: 'Connected successfully', classes: 'rounded green'});
                }catch(e){
                        console.log("Wallet is not connected");
                }
        }
}

document.addEventListener('DOMContentLoaded', function() {
    var elems = document.querySelectorAll('.modal');
    var instances = M.Modal.init(elems, undefined);

    (async () => {
        await checkConnected();
    })();

    connectWallet = document.getElementById('connectWallet');
    connectWallet.onclick = function(){
        //console.log("Connecting to metamask...");
        (async () => {

                const provider = connectedWallet(); //new ethers.providers.Web3Provider(window.ethereum, "any");
                await provider.send("eth_requestAccounts", []);
                const signer = provider.getSigner();

                //walletAddr.innerHTML = await compactAddress(await signer.getAddress());
                connectWallet.setAttribute('disabled','disabled');
                connectWallet.innerHTML = 'Connected';
                M.toast({html: 'Connected successfully', classes: 'rounded green'});


                //accountDisplay.style.visibility = "visible";

                //await getConnectedNetwork();
        })();
    };

    networkSwitch = document.getElementById('testnetBox');
    networkSwitch.onchange = function() {
        //console.log("Changing network/contract...");
        //document.getElementById('bribesTbl').scrollIntoView();
        loadBribes();
    }

    depositBribe = document.getElementById('depositBribe');
    depositBribe.onclick = function() {

        depositBribe.style = "display:none;";
        depositLoader = document.getElementById('depositLoading');
        depositLoader.style = "display:;";

        const provider = connectedWallet(); //new ethers.providers.Web3Provider(window.ethereum, "any");
        validatorAddr = document.getElementById('validatorAddr').value;
        rewardToken = document.getElementById('rewardToken').value;
        totalTokens = document.getElementById('totalTokens').value;
        tokensPerAIUS = document.getElementById('tokensPerAIUS').value;

        networkSwitch = document.getElementById('testnetBox');
        networkContract = networkSwitch.checked ? TEST_ARBIUS_BRIBE_CONTRACT : ARBIUS_BRIBE_CONTRACT;
        
        if(validatorAddr == "" || rewardToken == "" || totalTokens == "" || tokensPerAIUS == ""){
                M.toast({html: 'Missing required field for deposit', classes: 'rounded red'});
                depositLoader.style = "display:none;";
                depositBribe.style = "display:;";
                return;
        }

        (async () => {
            await provider.send("eth_requestAccounts", []);
            const signer = provider.getSigner();

            totalTokensBN = 0;
            decimals = 18;

            if(rewardToken != "0x0000000000000000000000000000000000000000"){ // ERC-20, need approval
                const ERC_Contract = new ethers.Contract(rewardToken, ERC20_ABI, signer);
                decimals = await ERC_Contract.decimals();
                totalTokensBN = ethers.BigNumber.from((totalTokens*10**decimals).toString());
                approvalTx = await ERC_Contract.approve(networkContract, totalTokensBN);
                approvalReceipt = await approvalTx.wait();
                M.toast({html: 'Token approval successful. Please continue with deposit.', classes: 'rounded green'});
            }else{
                totalTokensBN = ethers.BigNumber.from((totalTokens*10**18).toString());
            }


            const contractABI = [{
                "inputs": [
                        {
                                "internalType": "address",
                                "name": "bribeToken",
                                "type": "address"
                        },
                        {
                                "internalType": "uint256",
                                "name": "bribeAmount",
                                "type": "uint256"
                        },
                        {
                                "internalType": "uint256",
                                "name": "tokenToValidatorRatio",
                                "type": "uint256"
                        },
                        {
                                "internalType": "address",
                                "name": "validator",
                                "type": "address"
                        }
                ],
                "name": "depositBribe",
                "outputs": [],
                "stateMutability": "payable",
                "type": "function"
        }];
        //networkSwitch = document.getElementById('testnetBox');
        //networkContract = networkSwitch.checked ? TEST_ARBIUS_BRIBE_CONTRACT : ARBIUS_BRIBE_CONTRACT;
        const BribeContract = new ethers.Contract(networkContract, abi, signer)

        //var depositIdx = await BribeContract.depositIndex();
        //console.log(depositIdx);

        try{
                // TO-DO: Only add this options param if we're depositing ETH
                const options = {value: ethers.BigNumber.from((totalTokens*10**18).toString())};

                //totalTokensBN = ethers.BigNumber.from((totalTokens*10**decimals).toString());
                tokensPerAIUSBN = ethers.BigNumber.from((tokensPerAIUS*10**decimals).toString());
                nativeETH = rewardToken == "0x0000000000000000000000000000000000000000";
                tx = undefined;
                if (nativeETH){
                  tx = await BribeContract.depositBribe(rewardToken, totalTokensBN, tokensPerAIUSBN, validatorAddr, options);
                }else{
                  tx = await BribeContract.depositBribe(rewardToken, totalTokensBN, tokensPerAIUSBN, validatorAddr);
                }

                receipt = await tx.wait();
                M.toast({html: 'Deposit successful', classes: 'rounded green'});
                depositLoader.style = "display:none;";
                depositBribe.style = "display:;";
                loadBribes();
                return true;
        }catch(e){
                M.toast({html: 'Error during deposit. Please see console', classes: 'rounded red'});
                console.log(e);
                depositLoader.style = "display:none;";
                depositBribe.style = "display:;";
                return false;
        }
        })();
    };

    approveAIUS = document.getElementById('approveAIUS');
    confirmAIUS = document.getElementById('confirmAIUS');
    confirmAIUS.onclick = function() {
        //console.log("Depositing AIUS...");
        (async () => {
        approveAIUSLoader = document.getElementById('claimLoading');
        approveAIUSLoader.style = "display:;";
        //approveAIUS.style = "display:none;";
        confirmAIUS.style = "display:none;";
        cancelClaim = document.getElementById("cancelClaim");
        cancelClaim.style = "display:none;";
        try{
            const provider = connectedWallet(); //new ethers.providers.Web3Provider(window.ethereum, "any");
            await provider.send("eth_requestAccounts", []);
            const signer = provider.getSigner();
            networkSwitch = document.getElementById('testnetBox');
            networkToken = networkSwitch.checked ? TEST_AIUS_TOKEN : AIUS_TOKEN;
            networkContract = networkSwitch.checked ? TEST_ARBIUS_BRIBE_CONTRACT : ARBIUS_BRIBE_CONTRACT;
            networkEngine = networkSwitch.checked ? TEST_ARBIUS_ENGINE : ARBIUS_ENGINE;
            const BribeContract = new ethers.Contract(networkContract, abi, signer);

            validator = document.getElementById('incentivizedValidator').innerHTML;
            AIUSamt = document.getElementById('aiusDepositAmt').value;
            AIUSAmtBN = ethers.BigNumber.from((AIUSamt*10**18).toString());
            console.log(validator);
            console.log(AIUSAmtBN);

            claimTx = await BribeContract.claim(validator, AIUSAmtBN);
            receipt = await claimTx.wait();
            console.log(receipt);
            M.toast({html: 'AIUS deposited successfully', classes: 'rounded green'});

            approveAIUSLoader.style = "display:none;";
            modalHeader = document.getElementById('modalHeader');
            modalHeader.innerHTML = "Success!";
            modalRow = document.getElementById('modalRow');
            txLink = ARBITRUM_NOVA_EXPLORER_URL + "/tx/" + receipt['transactionHash'];
            txLinkElem = "<a href=" + txLink + "\" target=\"_blank\">" + receipt["transactionHash"] + "</a>";
            modalRow.innerHTML = "<center>  <i class=\"large material-icons\">check_circle</i></center><br /><p>Transaction: " + txLinkElem + "</p>";
        }catch(e){
           M.toast({html: 'Error during deposit. Please see logs', classes: 'rounded red'});
           console.log("Error: " + e);
           approveAIUSLoader.style = "display:none;";
           confirmAIUS.style = "display:;";
           cancelClaim.style = "display:;";
        }
        })();
    }

                approveAIUS.onclick = function() {
                        (async () => {
                          approveAIUSLoader = document.getElementById('claimLoading');
                          approveAIUSLoader.style = "display:;";
                          approveAIUS.style = "display:none;";
                          cancelClaim = document.getElementById('cancelClaim');
                          cancelClaim.style = "display:none;";
                          approveAmt = document.getElementById('aiusDepositAmt');
                          try{
                            const provider = connectedWallet(); //new ethers.providers.Web3Provider(window.ethereum, "any");
                            await provider.send("eth_requestAccounts", []);
                            const signer = provider.getSigner();
                            if (signer == undefined){
                              M.toast({html: 'Please connect wallet first', classes: 'rounded red'});
                              approveAIUS.style = "display:;";
                              approveAIUSLoader.style = "display:none;";
                              cancelClaim.style = "display:;";
                                return;
                            }
                            networkSwitch = document.getElementById('testnetBox');
                            networkToken = networkSwitch.checked ? TEST_AIUS_TOKEN : AIUS_TOKEN;
                            networkContract = networkSwitch.checked ? TEST_ARBIUS_BRIBE_CONTRACT : ARBIUS_BRIBE_CONTRACT;
                            const AIUSContract = new ethers.Contract(networkToken, ERC20_ABI, signer);
                            signerAddr = await signer.getAddress()
                            allowance = await AIUSContract.allowance(signerAddr, networkContract);

                            if (allowance < approveAmt.value * 10**18){
                              approveBN = ethers.BigNumber.from((approveAmt.value*10**18).toString());
                              approveTx = await AIUSContract.approve(networkContract, approveBN);
                              receipt = await approveTx.wait();
                              M.toast({html: 'Approved AIUS', classes: 'rounded green'});
                              approveAIUS.style = "display:;";
                              approveAIUSLoader.style = "display:none;";
                              cancelClaim.style = "display:;";
                            }else{
                                M.toast({html: 'Allowance already exists', classes: 'rounded green'});
                                approveAIUS.style = "display:;";
                                approveAIUSLoader.style = "display:none;";
                                cancelClaim.style = "display:;";
                            }
                              document.getElementById('approveAIUS').style = "display:none;";
                              document.getElementById('confirmAIUS').style = "display:;";
                          }catch(e){
                                M.toast({html: 'Error, are you connected?', classes: 'rounded red'});
                                console.log("Error: " + e);
                                approveAIUS.style = "display:;";
                                approveAIUSLoader.style = "display:none;";
                                cancelClaim.style = "display:;";
                          }
                        })();

                }

        loadBribes();
}, false);

function loadBribes() {
    var table = document.getElementById('bribesTbl');
    var rowCount = table.rows.length;

    for (var i = rowCount - 1; i > 0; i--) {
      table.deleteRow(i);
    }
    (async () => {
        networkSwitch = document.getElementById('testnetBox');
        networkContract = networkSwitch.checked ? TEST_ARBIUS_BRIBE_CONTRACT : ARBIUS_BRIBE_CONTRACT;

        const BribeContract = new ethers.Contract(networkContract, abi, provider);

        const depositIndex = await BribeContract.depositIndex();

        document.getElementById('bribeCount').innerHTML = Number(depositIndex._hex);
        var tbodyRef = document.getElementById('bribesTbl').getElementsByTagName('tbody')[0];

        for (i = 0; i < depositIndex; i++) {
                var deposit = await BribeContract.deposits(i);

                if(deposit[3]==0 || deposit[2]==0){ // deposit/bribe is drained
                   //console.log("Skipping empty bribe");
                   continue;
                }

                var newRow = tbodyRef.insertRow();
                var newCell = newRow.insertCell();
                const div = document.createElement('div');
                div.innerHTML = shortenValidatorAddress(deposit[0]);
                var newCell2 = newRow.insertCell();

                rewardTokenList = reward_tokens[deposit[1]]
                var newText2 = document.createTextNode(rewardTokenList[0]);
                newCell.appendChild(div);
                newCell2.appendChild(newText2);
                var newCell3 = newRow.insertCell();
                var tokenDecimals = rewardTokenList[1];

                var tokensPerAIUS = deposit[3]/10**tokenDecimals;
 
                var tokensPerAIUSText = '';
                if (tokensPerAIUS.toString().includes('-')){ // replace scientific notation with long form
                        tokensPerAIUSText = tokensPerAIUS.toFixed(tokensPerAIUS.toString().split('-')[1]);
                }else{
                        tokensPerAIUSText = tokensPerAIUS;
                }

                var newText3 = document.createTextNode(tokensPerAIUSText); // tokens per AIUS
                newCell3.appendChild(newText3);
                var newCell4 = newRow.insertCell();

                var tokensRemaining = deposit[2]/10**tokenDecimals;

                tokensRemainingText = '';
                if (tokensRemaining.toString().includes('-')){
                        tokensRemainingText = tokensRemaining.toFixed(tokensRemaining.toString().split('-')[1]);
                }else{
                        tokensRemainingText = tokensRemaining;
                }

                var newText4 = document.createTextNode(tokensRemainingText); // total tokens remaining
                newCell4.appendChild(newText4);

                var newCell5 = newRow.insertCell()
                var newText5 = document.createTextNode(moment(deposit[4]*1000).fromNow()); // expiration
                newCell5.appendChild(newText5);

                var newCell6 = newRow.insertCell();
                var claimBtn = document.createElement('div');
                newCell6.appendChild(claimBtn);

                claimBtn.innerHTML = "<center><button id=\"claim-" + i.toString() + "\" class=\"btn\">Deposit AIUS</button></center>";
                claimBtn.onclick = function() {
                        (async () => {
                          bribeId = this.innerHTML.split('claim-')[1].split("\"")[0];
                          //console.log("Claiming for " + bribeId.toString());

                          var instance = M.Modal.getInstance(document.getElementById('depositClaimModal'));
                          instance.open();

                          bribe = await BribeContract.deposits(bribeId);
                          //console.log("Claiming for " + bribe[0]);
                          document.getElementById('incentivizedValidator').innerHTML = bribe[0];
                        })();
                };

        }
    })();
}