import { initializeKeypair } from "./initializeKeypair";
import {
	clusterApiUrl,
	Connection,
	Keypair,
	LAMPORTS_PER_SOL,
	sendAndConfirmTransaction,
	SystemProgram,
	Transaction,
} from "@solana/web3.js";
import fs from "fs";
import {
	bundlrStorage,
	keypairIdentity,
	Metaplex,
	toMetaplexFile,
} from "@metaplex-foundation/js";
import {
	DataV2,
	createCreateMetadataAccountV2Instruction,
} from "@metaplex-foundation/mpl-token-metadata";
import {
	Account,
	createAssociatedTokenAccountInstruction,
	createInitializeMintInstruction,
	createMintToInstruction,
	getAccount,
	getAssociatedTokenAddress,
	getMinimumBalanceForRentExemptMint,
	MINT_SIZE,
	TokenAccountNotFoundError,
	TokenInvalidAccountOwnerError,
	TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const RPC_URL = clusterApiUrl("devnet");
const connection = new Connection(RPC_URL);

const tokenDetails = {
	name: "ROBO COIN",
	description: "Official crypto currency for ROBOTAR NFT project.",
	image: fs.readFileSync("assets/logo.png"),
	symbol: "ROBO",
	decimals: 2,
	amountToMint: 1000,
};

const main = async () => {
	const ownerWallet = await initializeKeypair(connection);

	// rent for token mint
	console.log("Getting rent for token account...");
	const rentLamports = await getMinimumBalanceForRentExemptMint(connection);
	console.log("Rent:", rentLamports);
	console.log("Rent (in SOL):", rentLamports / LAMPORTS_PER_SOL);

	console.log("\n");

	// keypair for new token mint
	console.log("Generating keypair for token mint account...");
	const mintKeypair = Keypair.generate();
	console.log("Token mint account:", mintKeypair.publicKey.toString());

	console.log("\n");

	const metaplex = Metaplex.make(connection)
		.use(keypairIdentity(ownerWallet))
		.use(
			bundlrStorage({
				address: "https://devnet.bundlr.network",
				providerUrl: RPC_URL,
				timeout: 60000,
			})
		);

	// get metadata PDA for token mint
	console.log("Getting Metadata PDA for token mint account...");
	const metadataPDA = metaplex
		.nfts()
		.pdas()
		.metadata({ mint: mintKeypair.publicKey });
	console.log("Token metadata PDA:", metadataPDA.toString());

	console.log("\n");

	// get associated token account address for use
	console.log("Getting associated token account from mint account...");
	const tokenATA = await getAssociatedTokenAddress(
		mintKeypair.publicKey,
		ownerWallet.publicKey
	);
	console.log("Associated token account:", tokenATA.toString());

	console.log("\n");

	// uploading token image and getting uri
	console.log("Uploading token logo image...");
	const imageFile = toMetaplexFile(tokenDetails.image, "logo.png");
	const imageUri = await metaplex.storage().upload(imageFile);
	console.log("Token logo image uri:", imageUri);

	console.log("\n");

	// upload metadata and get metadata uri (off chain metadata)
	console.log("Uploading token metadata...");
	const { uri } = await metaplex.nfts().uploadMetadata({
		name: tokenDetails.name,
		description: tokenDetails.description,
		image: imageUri,
	});
	console.log("Token metadata uri:", uri);

	console.log("\n");

	// onchain metadata format
	const tokenMetadata = {
		name: tokenDetails.name,
		symbol: tokenDetails.symbol,
		uri: uri,
		sellerFeeBasisPoints: 0,
		creators: null,
		collection: null,
		uses: null,
	} as DataV2;

	// transaction to create metadata account
	const transaction = new Transaction();

	// create new account
	const createSolanaAccountInstruction = SystemProgram.createAccount({
		fromPubkey: ownerWallet.publicKey,
		newAccountPubkey: mintKeypair.publicKey,
		space: MINT_SIZE,
		lamports: rentLamports,
		programId: TOKEN_PROGRAM_ID,
	});

	// create new token mint
	const createMintAccountInstruction = createInitializeMintInstruction(
		mintKeypair.publicKey,
		tokenDetails.decimals,
		ownerWallet.publicKey,
		ownerWallet.publicKey,
		TOKEN_PROGRAM_ID
	);

	// create metadata account
	const createMetadataAccountInstruction =
		createCreateMetadataAccountV2Instruction(
			{
				metadata: metadataPDA,
				mint: mintKeypair.publicKey,
				mintAuthority: ownerWallet.publicKey,
				payer: ownerWallet.publicKey,
				updateAuthority: ownerWallet.publicKey,
			},
			{
				createMetadataAccountArgsV2: {
					data: tokenMetadata,
					isMutable: true,
				},
			}
		);

	transaction.add(
		createSolanaAccountInstruction,
		createMintAccountInstruction,
		createMetadataAccountInstruction
	);

	// instruction to create ATA
	const createTokenAccountInstruction =
		createAssociatedTokenAccountInstruction(
			ownerWallet.publicKey, // payer
			tokenATA, // token address
			ownerWallet.publicKey, // token owner
			mintKeypair.publicKey // token mint
		);

	let tokenAccount: Account;

	try {
		// check if token account already exists
		tokenAccount = await getAccount(
			connection, // connection
			tokenATA // token address
		);
	} catch (error) {
		if (
			error instanceof TokenAccountNotFoundError ||
			error instanceof TokenInvalidAccountOwnerError
		) {
			try {
				// add instruction to create token account if one does not exist
				transaction.add(createTokenAccountInstruction);
			} catch (error) {}
		} else {
			throw error;
		}
	}

	// mint tokens to token account
	const tokenMintInstruction = createMintToInstruction(
		mintKeypair.publicKey,
		tokenATA,
		ownerWallet.publicKey,
		tokenDetails.amountToMint * Math.pow(10, tokenDetails.decimals)
	);

	transaction.add(tokenMintInstruction);

	// send transaction
	console.log("Sending token creation transaction...");
	const transactionSignature = await sendAndConfirmTransaction(
		connection,
		transaction,
		[ownerWallet, mintKeypair]
	);
	console.log(
		`Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
	);

	console.log("\n");
};

main()
	.then(() => {
		console.log("Script finished successfully!");
	})
	.catch((error) => {
		console.error(error);
	});
