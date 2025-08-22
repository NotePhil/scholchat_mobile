import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  section: {
    padding: 16,
    marginBottom: 16
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#111827'
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#111827'
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#111827'
  },
  cardText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 20
  },
  heroContainer: {
    height: 300,
    width: '100%',
    marginBottom: 24,
    position: 'relative'
  },
  heroImage: {
    width: '100%',
    height: '100%'
  },
  aboutImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 20,
    marginTop: 10,
  },
  productsImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 20,
  },
  faqImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 10,
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#FFFFFF'
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  featureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    width: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#111827',
    textAlign: 'center'
  },
  featureDescription: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center'
  },
  featureSlider: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 180,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    position: 'relative'
  },
  featureSlide: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    bottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0
  },
  sliderIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  sliderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#111827'
  },
  sliderDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center'
  },
  sliderDots: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center'
  },
  sliderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4
  },
  goalContainer: {
    flexDirection: 'column'
  },
  goalImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 16
  },
  goalTextContainer: {
    flex: 1
  },
  goalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#111827'
  },
  goalDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center'
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600'
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '600'
  },
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  teamMember: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 20,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  teamImageContainer: {
    position: 'relative',
    marginBottom: 10
  },
  teamImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#EEF2FF'
  },
  teamIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4F46E5',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  teamName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    textAlign: 'center'
  },
  teamRole: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center'
  },
  searchContainer: {
    marginBottom: 16
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827'
  },
  faqContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden'
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  faqQuestion: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  faqQuestionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
    marginRight: 8
  },
  faqAnswer: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: '#F9FAFB'
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    position: 'relative'
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8
  },
  authTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24
  },
  authTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  activeAuthTab: {
    borderBottomColor: '#4F46E5'
  },
  authTabText: {
    fontSize: 16,
    color: '#6B7280'
  },
  activeAuthTabText: {
    color: '#4F46E5',
    fontWeight: '600'
  },
  authForm: {
    width: '100%'
  },
  inputContainer: {
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827'
  },
  authSwitchText: {
    textAlign: 'center',
    marginTop: 16,
    color: '#6B7280'
  },
  authSwitchLink: {
    color: '#4F46E5',
    fontWeight: '600'
  },
  signupProgress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center'
  },
  activeProgressStep: {
    backgroundColor: '#4F46E5'
  },
  progressStepText: {
    fontSize: 14,
    color: '#6B7280'
  },
  activeProgressStepText: {
    color: '#FFFFFF'
  },
  progressLine: {
    width: 32,
    height: 2,
    backgroundColor: '#E5E7EB'
  },
  progressLabel: {
    fontSize: 12,
    color: '#6B7280'
  },
  phoneInputContainer: {
    flexDirection: 'row'
  },
  countryCodeContainer: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    marginRight: 8,
    justifyContent: 'center'
  },
  countryCode: {
    fontSize: 14,
    color: '#111827'
  },
  phoneInput: {
    flex: 1
  },
  navBar: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 4,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  navBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  logo: {
    width: 80,
    height: 80,
    resizeMode: 'contain'
  },
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827'
  },
  loginButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  },
  mainContent: {
    flex: 1
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingHorizontal: 16,
  },
  statItem: {
    alignItems: 'center',
    width: '30%'
  },
  statIcon: {
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4
  },
  statLabel: {
    fontSize: 12,
    color: '#E0E7FF',
    textAlign: 'center'
  },
  footerSection: {
    marginBottom: 24,
  },
  footerLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  footerLogo: {
    width: 40,
    height: 40,
    marginRight: 8,
  },
  footerLogoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#E5E7EB',
    marginBottom: 12,
    lineHeight: 20,
  },
  footerLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  footerLink: {
    marginHorizontal: 8,
  },
  footerLinkText: {
    fontSize: 14,
    color: '#93C5FD',
  },
  socialIcons: {
    flexDirection: 'row',
    marginTop: 12,
  },
  socialIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24
  },
  titleIcon: {
    marginLeft: 10,
    marginBottom: 20
  },
  missionCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4F46E5'
  },
  historyCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981'
  },
  teamCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6'
  },
  valuesCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  cardIcon: {
    marginRight: 8
  },
  valuesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10
  },
  valueItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F5F3FF',
    borderRadius: 8,
    marginBottom: 10
  },
  valueText: {
    marginLeft: 8,
    color: '#4F46E5',
    fontWeight: '500'
  },
});