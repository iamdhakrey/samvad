use hyper_rustls::{HttpsConnector, HttpsConnectorBuilder};
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpConnector;
use hyper_util::rt::TokioExecutor;
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{ClientConfig, DigitallySignedStruct, RootCertStore, SignatureScheme};
use samvad_error::AppResult;
use std::sync::Arc;
use tonic::body::Body;

#[derive(Debug)]
struct NoCertVerification;

impl ServerCertVerifier for NoCertVerification {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        vec![
            SignatureScheme::RSA_PKCS1_SHA256,
            SignatureScheme::ECDSA_NISTP256_SHA256,
            SignatureScheme::ECDSA_NISTP384_SHA384,
            SignatureScheme::ED25519,
        ]
    }
}
pub(crate) fn get_transport(
    validate_certificates: bool,
    // client_cert: Option<ClientCertificateConfig>,
) -> AppResult<Client<HttpsConnector<HttpConnector>, Body>> {
    let tls_config = if validate_certificates {
        // Load platform-native certificate roots (critical for production)
        let certs =
            rustls_native_certs::load_native_certs().expect("Failed to load native certificates");
        let mut root_store = RootCertStore::empty();
        for cert in certs {
            root_store.add(cert).unwrap();
        }

        ClientConfig::builder()
            .with_root_certificates(root_store)
            .with_no_client_auth()
    } else {
        // Bypass all validation
        ClientConfig::builder()
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(NoCertVerification))
            .with_no_client_auth()
    };

    // REMOVED: tls_config.alpn_protocols = vec![b"h2".to_vec()];

    let mut http = HttpConnector::new();
    http.enforce_http(false);

    let connector = HttpsConnectorBuilder::new()
        .with_tls_config(tls_config)
        .https_or_http()
        .enable_http2()
        .build();

    let client = Client::builder(TokioExecutor::new())
        .pool_max_idle_per_host(0)
        .http2_only(true)
        .build(connector);

    Ok(client)
}
